const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');
const { CommonActions, StackRouter } = require('@react-navigation/routers');

// Render the actual navigator with a lightweight native-stack stand-in. The
// installed StackRouter then verifies how those rendered screen lists change state.
let profilePending = false;
const Navigator = () => null;
const Screen = () => null;
const source = fs.readFileSync(path.join(__dirname, '../../src/navigation/AuthNavigator.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const moduleForTest = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleForTest,
  exports: moduleForTest.exports,
  require(id) {
    if (id === 'react/jsx-runtime') return require(id);
    if (id === '@react-navigation/native-stack') {
      return { createNativeStackNavigator: () => ({ Navigator, Screen }) };
    }
    if (id === '@/features/auth/AuthContext') return { useAuth: () => ({ profilePending }) };
    return { [path.basename(id).replace(/\.tsx?$/, '')]: () => null };
  },
}, { filename: 'AuthNavigator.tsx' });

// Screen imports use named exports; resolve each stub by its import path.
function screenNames(element) {
  const children = [];
  function visit(node) {
    if (!React.isValidElement(node)) return;
    if (node.type === Screen) children.push({ name: node.props.name, navigationKey: node.props.navigationKey });
    React.Children.forEach(node.props.children, visit);
  }
  visit(element);
  return children;
}

test('Google profile gate replaces mounted Register or SignIn with setup, then Back restores Register', () => {
  const router = StackRouter({});
  const routeParamList = {};
  const read = (pending) => {
    profilePending = pending;
    const rendered = moduleForTest.exports.AuthNavigator();
    assert.equal(rendered.type, Navigator);
    return screenNames(rendered);
  };
  const signedOut = read(false);
  const names = signedOut.map((screen) => screen.name);
  assert.equal(names[0], 'Register');
  assert.ok(names.includes('SignIn'));
  assert.ok(names.includes('CreateProfile'));

  for (const currentScreen of ['Register', 'SignIn']) {
    let state = router.getInitialState({ routeNames: names, routeParamList });
    if (currentScreen === 'SignIn') {
      state = router.getStateForAction(state, CommonActions.navigate('SignIn'), { routeParamList, routeGetIdList: {} });
    }
    assert.equal(state.routes[state.index].name, currentScreen);

    const pending = read(true);
    assert.deepEqual(pending.map((screen) => screen.name), ['CreateProfile']);
    state = router.getStateForRouteNamesChange(state, {
      routeNames: pending.map((screen) => screen.name), routeParamList, routeKeyChanges: [],
    });
    assert.deepEqual(state.routes.map((route) => route.name), ['CreateProfile']);
    assert.equal(state.index, 0);

    const afterBack = read(false);
    assert.notEqual(pending[0].navigationKey, afterBack.find((screen) => screen.name === 'CreateProfile').navigationKey);
    state = router.getStateForRouteNamesChange(state, {
      routeNames: afterBack.map((screen) => screen.name), routeParamList, routeKeyChanges: ['CreateProfile'],
    });
    assert.deepEqual(state.routes.map((route) => route.name), ['Register']);
  }
});

test('profile Back signs out pending Google session; email signup Back pops the stack', async () => {
  const Dummy = () => null;
  const navigation = { goBackCalls: 0, goBack() { this.goBackCalls++; }, setOptions() {} };
  let pending = true;
  let signOutCalls = 0;
  const source = fs.readFileSync(path.join(__dirname, '../../src/features/auth/screens/CreateProfileScreen.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const screenModule = { exports: {} };
  vm.runInNewContext(compiled, {
    module: screenModule,
    exports: screenModule.exports,
    require(id) {
      if (id === 'react/jsx-runtime') return require(id);
      if (id === 'react') return {
        useState: (initial) => [initial, () => {}], useRef: (initial) => ({ current: initial }), useEffect: () => {},
      };
      if (id === 'react-native') return {
        Alert: {}, Image: Dummy, KeyboardAvoidingView: Dummy, Platform: { OS: 'web' },
        Pressable: Dummy, ScrollView: Dummy, StyleSheet: { create: (styles) => styles },
        Text: Dummy, TextInput: Dummy, View: Dummy,
      };
      if (id === '@react-navigation/native') return { useNavigation: () => navigation };
      if (id === '@/features/auth/AuthContext') return {
        useAuth: () => ({
          profilePending: pending, pendingProfileDetails: null, createAccount: async () => {},
          signOut: async () => { signOutCalls++; },
        }),
      };
      if (id === '@/theme') return {
        colors: {}, gradientDirection: { vertical: {}, horizontal: {} }, gradients: {},
        radius: {}, sizes: {}, spacing: {}, text: {},
      };
      if (id === 'react-native-svg') return { __esModule: true, default: Dummy, Circle: Dummy, Path: Dummy };
      return new Proxy({}, { get: () => Dummy });
    },
  }, { filename: 'CreateProfileScreen.tsx' });

  function backButton() {
    const tree = screenModule.exports.CreateProfileScreen();
    let found;
    function visit(node) {
      if (!React.isValidElement(node)) return;
      if (node.props.accessibilityLabel === (pending ? 'Back to registration' : 'Back to password')) found = node;
      React.Children.forEach(node.props.children, visit);
    }
    visit(tree);
    assert.ok(found);
    assert.equal(found.props.disabled, false);
    return found;
  }

  await backButton().props.onPress();
  assert.equal(signOutCalls, 1);
  assert.equal(navigation.goBackCalls, 0);

  pending = false;
  await backButton().props.onPress();
  assert.equal(signOutCalls, 1);
  assert.equal(navigation.goBackCalls, 1);
});
