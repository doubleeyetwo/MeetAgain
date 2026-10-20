const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const React = require('react');
const ts = require('typescript');

function loadAddMembers({ friends, createGroup }) {
  let currentFriends = friends;
  const source = fs.readFileSync(path.join(__dirname, '../../src/features/messages/screens/AddMembersScreen.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  const state = [];
  const refs = [];
  const effects = [];
  let pendingEffects = [];
  const navigation = { goBack() {}, setOptions() {}, replaceCalls: [], replace(...args) { this.replaceCalls.push(args); } };
  const useState = (initial) => {
    const index = stateIndex++;
    if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
    return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
  };
  const useRef = (initial) => {
    const index = refIndex++;
    if (!(index in refs)) refs[index] = { current: initial };
    return refs[index];
  };
  const useEffect = (callback, deps) => {
    const index = effectIndex++;
    const previous = effects[index];
    const changed = !previous || !deps || deps.some((value, item) => !Object.is(value, previous.deps[item]));
    if (changed) pendingEffects.push({ index, callback, deps });
  };
  const ReactMock = {
    useState,
    useRef,
    useEffect,
    useMemo: (callback) => callback(),
  };
  const component = (name) => { const Component = () => null; Component.displayName = name; return Component; };
  const Dummy = component('Dummy');
  const native = {
    ActivityIndicator: component('ActivityIndicator'), FlatList: component('FlatList'), Image: component('Image'), Pressable: component('Pressable'), StyleSheet: { create: (value) => value, hairlineWidth: 1 },
    Text: component('Text'), TextInput: component('TextInput'), View: component('View'),
  };
  const displaySource = fs.readFileSync(path.join(__dirname, '../../src/features/messages/FriendDisplay.tsx'), 'utf8');
  const displayCompiled = ts.transpileModule(displaySource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const displayModule = { exports: {} };
  vm.runInNewContext(displayCompiled, {
    module: displayModule,
    exports: displayModule.exports,
    require(id) {
      if (id === 'react/jsx-runtime') return require(id);
      if (id === 'react-native') return native;
      if (id === '@/theme') return { colors: { white: '#fff', cardLighter: '#321' } };
      throw new Error(`Unexpected FriendDisplay import: ${id}`);
    },
  }, { filename: 'FriendDisplay.tsx' });
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(id) {
      if (id === 'react/jsx-runtime') return require(id);
      if (id === 'react') return ReactMock;
      if (id === 'react-native') return native;
      if (id === '@expo/vector-icons') return { Ionicons: Dummy };
      if (id === 'expo-linear-gradient') return { LinearGradient: Dummy };
      if (id === 'react-native-safe-area-context') return { SafeAreaView: Dummy };
      if (id === '@react-navigation/native') return { useNavigation: () => navigation };
      if (id === '@/features/auth/AuthContext') return { useAuth: () => ({ user: { uid: 'alice' } }) };
      if (id === '@/features/messages/useAcceptedMessageFriends') return { useAcceptedMessageFriends: () => ({ friends: currentFriends, loading: false, error: false, retry() {} }) };
      if (id === '@/features/messages/groups') return { createGroup, MAX_GROUP_MEMBERS: 10 };
      if (id === '@/features/messages/FriendDisplay') return displayModule.exports;
      if (id === '@/theme') return {
        colors: { white: '#fff', cardLighter: '#321', cardDarker: '#210', primaryAccent: '#70f', linkAccent: '#99f' },
        gradientDirection: { vertical: {} }, gradients: { background: ['#111', '#000'] }, spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
        text: { title: {}, body: {}, header: {} },
      };
      return {};
    },
  }, { filename: 'AddMembersScreen.tsx' });

  function render() {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    pendingEffects = [];
    const tree = module.exports.AddMembersScreen();
    for (const effect of pendingEffects) {
      const previous = effects[effect.index];
      if (previous?.cleanup) previous.cleanup();
      const cleanup = effect.callback();
      effects[effect.index] = { deps: effect.deps, cleanup };
    }
    return tree;
  }
  function unmount() {
    for (const effect of effects) effect?.cleanup?.();
  }
  return { render, unmount, navigation, Pressable: native.Pressable, TextInput: native.TextInput, FlatList: native.FlatList, setFriends: (next) => { currentFriends = next; } };
}

function find(tree, type, predicate = () => true) {
  let match;
  function visit(node) {
    if (match || !React.isValidElement(node)) return;
    if (node.type === type && predicate(node)) { match = node; return; }
    React.Children.forEach(node.props.children, visit);
  }
  visit(tree);
  return match;
}

const people = [
  { uid: 'bob', username: 'bobby', profile: { displayName: 'Bob', username: 'bobby' } },
  { uid: 'cara', username: 'caramel', profile: { displayName: 'Cara', username: 'caramel' } },
];

test('an older profile read cannot restore a friend removed by a newer friendship snapshot', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../../src/features/messages/useAcceptedMessageFriends.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const values = [];
  const updates = [];
  let index = 0;
  let effect;
  let friendshipListener;
  let finishProfile;
  const deferredProfile = new Promise((resolve) => { finishProfile = resolve; });
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(id) {
      if (id === 'react') return {
        useState(initial) {
          const slot = index++;
          if (!(slot in values)) values[slot] = initial;
          return [values[slot], (next) => {
            values[slot] = typeof next === 'function' ? next(values[slot]) : next;
            updates.push(values[slot]);
          }];
        },
        useEffect(callback) { effect = callback; },
      };
      if (id === 'firebase/firestore') return { doc: (_db, collection, uid) => ({ collection, uid }), getDoc: () => deferredProfile };
      if (id === '@/config/firebase') return { db: {} };
      if (id === '@/data/firestorePaths') return { collections: { publicProfiles: 'publicProfiles' } };
      if (id === '@/features/auth/AuthContext') return { useAuth: () => ({ user: { uid: 'alice' } }) };
      if (id === '@/features/friends/friendships') return { watchFriendships: (_uid, listener) => { friendshipListener = listener; return () => {}; } };
      return {};
    },
  });
  const hook = module.exports.useAcceptedMessageFriends();
  const cleanup = effect();
  const accepted = [{ memberIds: ['alice', 'bob'], requesterId: 'alice', requesterUsername: 'alice', recipientUsername: 'bobby', status: 'accepted' }];
  friendshipListener(accepted);
  friendshipListener([]);
  finishProfile({ exists: () => true, id: 'bob', data: () => ({ displayName: 'Bob', username: 'bobby' }) });
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(Array.from(hook.friends), []);
  assert.deepEqual(Array.from(updates.at(-1)), []);
  cleanup();
});

test('Add Members selection survives search filtering and supports toggling', () => {
  const ui = loadAddMembers({ friends: people, createGroup: async () => { throw new Error('unexpected submit'); } });
  let tree = ui.render();
  let list = find(tree, ui.FlatList);
  const bobRow = list.props.renderItem({ item: people[0] });
  assert.equal(bobRow.props.accessibilityState.checked, false);
  bobRow.props.onPress();
  tree = ui.render();
  ui.setFriends([people[1]]);
  tree = ui.render();
  tree = ui.render();
  assert.equal(find(tree, ui.FlatList).props.data.length, 1);
  assert.equal(find(tree, ui.Pressable, (element) => element.props.accessibilityRole === 'button' && element.props.children?.props?.children === 'Confirm Members').props.disabled, true);
  ui.setFriends(people);
  tree = ui.render();
  list = find(tree, ui.FlatList);
  assert.equal(list.props.renderItem({ item: people[0] }).props.accessibilityState.checked, false);
  list.props.renderItem({ item: people[0] }).props.onPress();
  tree = ui.render();
  let input = find(tree, ui.TextInput);
  input.props.onChangeText('cara');
  tree = ui.render();
  list = find(tree, ui.FlatList);
  assert.deepEqual(list.props.data.map((item) => item.uid), ['cara']);
  input = find(tree, ui.TextInput);
  input.props.onChangeText('');
  tree = ui.render();
  list = find(tree, ui.FlatList);
  assert.equal(list.props.renderItem({ item: people[0] }).props.accessibilityState.checked, true);
  list.props.renderItem({ item: people[0] }).props.onPress();
  tree = ui.render();
  list = find(tree, ui.FlatList);
  assert.equal(list.props.renderItem({ item: people[0] }).props.accessibilityState.checked, false);
});

test('Confirm locks against same-tick taps and skips navigation if the screen unmounts', async () => {
  let finishCreate;
  let calls = 0;
  const createGroup = () => {
    calls++;
    return new Promise((resolve) => { finishCreate = resolve; });
  };
  const ui = loadAddMembers({ friends: people, createGroup });
  let tree = ui.render();
  let list = find(tree, ui.FlatList);
  list.props.renderItem({ item: people[0] }).props.onPress();
  tree = ui.render();
  const confirm = find(tree, ui.Pressable, (element) => element.props.accessibilityRole === 'button' && element.props.children?.props?.children === 'Confirm Members');
  assert.ok(confirm);
  confirm.props.onPress();
  confirm.props.onPress();
  assert.equal(calls, 1);
  ui.unmount();
  finishCreate({ id: 'group1', name: 'Group1', memberIds: ['alice', 'bob'], createdBy: 'alice' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(ui.navigation.replaceCalls.length, 0);
});
