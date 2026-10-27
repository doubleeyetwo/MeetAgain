const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');

// Render the real screens with lightweight stand-ins for React Native, so the
// address a planner types on Choose Location can be followed into the params
// Review Event receives and the text it renders.

// Hook state for the component currently being rendered. Setters write here and
// the caller re-renders to see the next frame, the way React would.
let hookStates = [];
let hookIndex = 0;

function useStateStub(initial) {
  const slot = hookIndex++;
  if (!(slot in hookStates)) {
    hookStates[slot] = typeof initial === 'function' ? initial() : initial;
  }
  return [
    hookStates[slot],
    (next) => {
      hookStates[slot] =
        typeof next === 'function' ? next(hookStates[slot]) : next;
    },
  ];
}

const host = (name) => {
  const Component = () => null;
  Object.defineProperty(Component, 'name', { value: name });
  return Component;
};

const Text = host('Text');
const TextInput = host('TextInput');

// Any token read off the theme resolves to something harmless of the right shape.
const proxy = (value) => new Proxy({}, { get: () => value });

const reactNative = {
  Alert: { alert: () => {} },
  KeyboardAvoidingView: host('KeyboardAvoidingView'),
  Modal: host('Modal'),
  Platform: { OS: 'ios' },
  Pressable: host('Pressable'),
  ScrollView: host('ScrollView'),
  StyleSheet: { create: (sheet) => sheet },
  Text,
  TextInput,
  View: host('View'),
};

const theme = {
  colors: proxy('#000000'),
  fontFamily: proxy('Moderustic_400Regular'),
  radius: proxy(12),
  spacing: proxy(8),
  sizes: proxy(44),
  text: proxy({}),
  gradients: proxy(['#000000', '#111111']),
  gradientDirection: proxy({
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  }),
};

function loadScreen(relativePath) {
  const source = fs.readFileSync(
    path.join(__dirname, relativePath),
    'utf8'
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;

  const moduleForTest = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module: moduleForTest,
      exports: moduleForTest.exports,
      console,
      require(id) {
        if (id === 'react/jsx-runtime') return require(id);
        if (id === 'react') return { ...React, useState: useStateStub };
        if (id === 'react-native') return reactNative;
        if (id === '@expo/vector-icons') return { Ionicons: host('Ionicons') };
        if (id === 'expo-linear-gradient') {
          return { LinearGradient: host('LinearGradient') };
        }
        if (id === '@/theme') return theme;
        if (id === '@/components/ScreenHeader') {
          return { ScreenHeader: host('ScreenHeader') };
        }
        if (id === '@/components/ContinueButton') {
          return { ContinueButton: host('ContinueButton') };
        }
        return {};
      },
    },
    { filename: path.basename(relativePath) }
  );

  return moduleForTest.exports;
}

const { PickLocationScreen } = loadScreen(
  '../../src/features/events/screens/PickLocationScreen.tsx'
);
const { ReviewEventScreen } = loadScreen(
  '../../src/features/events/screens/ReviewEventScreen.tsx'
);

function render(Component, props) {
  hookIndex = 0;
  return Component(props);
}

function walk(node, visit) {
  if (Array.isArray(node)) {
    node.forEach((child) => walk(child, visit));
    return;
  }
  if (!React.isValidElement(node)) return;
  visit(node);
  React.Children.forEach(node.props.children, (child) =>
    walk(child, visit)
  );
}

// Every string rendered inside a <Text>, which is what a planner actually reads.
function visibleText(tree) {
  const found = [];
  walk(tree, (node) => {
    if (node.type !== Text) return;
    React.Children.forEach(node.props.children, (child) => {
      if (typeof child === 'string') found.push(child);
    });
  });
  return found;
}

function findByProp(tree, prop, value) {
  let match;
  walk(tree, (node) => {
    if (node.props[prop] === value) match = node;
  });
  return match;
}

function findByType(tree, type) {
  let match;
  walk(tree, (node) => {
    if (node.type === type) match = node;
  });
  return match;
}

// The suggestion card is the pressable whose own subtree renders that name.
function findPressableShowing(tree, label) {
  let match;
  walk(tree, (node) => {
    if (match || node.type !== reactNative.Pressable) return;
    if (visibleText(node).some((line) => line.includes(label))) {
      match = node;
    }
  });
  return match;
}

const baseParams = {
  eventName: 'Dinner Plans',
  category: 'Food & Dining',
};

test('a typed address reaches Review Event and is displayed exactly as entered', () => {
  hookStates = [];
  const navigated = [];
  const navigation = {
    navigate: (screen, params) => navigated.push({ screen, params }),
    goBack: () => {},
  };
  const props = { navigation, route: { params: baseParams } };

  const typed = '  456 Ocean Blvd. Long Beach  ';
  const input = findByType(render(PickLocationScreen, props), TextInput);
  input.props.onChangeText(typed);

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 1);
  assert.equal(navigated[0].screen, 'ReviewEvent');
  assert.equal(
    navigated[0].params.location,
    '456 Ocean Blvd. Long Beach'
  );
  assert.equal(navigated[0].params.eventName, 'Dinner Plans');

  hookStates = [];
  const review = render(ReviewEventScreen, {
    navigation,
    route: { params: navigated[0].params },
  });

  assert.ok(
    visibleText(review).includes('456 Ocean Blvd. Long Beach'),
    'Review Event should show the address exactly as it was entered'
  );
});

test('selecting a suggested location carries its address through', () => {
  hookStates = [];
  const navigated = [];
  const navigation = {
    navigate: (screen, params) => navigated.push({ screen, params }),
    goBack: () => {},
  };
  const props = { navigation, route: { params: baseParams } };

  const card = findPressableShowing(
    render(PickLocationScreen, props),
    "Pedro's Diner"
  );
  assert.ok(card, 'the suggested location should be pressable');

  const suggested = visibleText(card).find((line) =>
    line.includes('Main St.')
  );
  card.props.onPress();

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 1);
  assert.equal(navigated[0].params.location, suggested);
});

test('an empty address is rejected and the location is not changed', () => {
  hookStates = [];
  const navigated = [];
  const navigation = {
    navigate: (screen, params) => navigated.push({ screen, params }),
    goBack: () => {},
  };
  const props = { navigation, route: { params: baseParams } };

  const input = findByType(render(PickLocationScreen, props), TextInput);
  input.props.onChangeText('   ');

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 0);
  assert.ok(
    visibleText(render(PickLocationScreen, props)).includes(
      'Enter an address.'
    ),
    'an inline error should be shown'
  );
});

test('Review Event keeps its placeholder when no location was chosen', () => {
  hookStates = [];
  const review = render(ReviewEventScreen, {
    navigation: { navigate: () => {}, goBack: () => {} },
    route: { params: baseParams },
  });

  assert.ok(visibleText(review).includes('Location not selected'));
});
