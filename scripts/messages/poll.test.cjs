const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const React = require('react');
const ts = require('typescript');

const messagesDir = path.join(__dirname, '../../src/features/messages');

// Transpile a messages source file and run it with stubbed imports.
function load(file, imports) {
  const source = fs.readFileSync(path.join(messagesDir, file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    // Share Error so `instanceof Error` and assert.rejects see errors from both sides.
    Error,
    require(id) {
      if (id === 'react/jsx-runtime') return require(id);
      if (id in imports) return imports[id];
      throw new Error(`Unexpected ${file} import: ${id}`);
    },
  }, { filename: file });
  return module.exports;
}

function createHooks() {
  let stateIndex = 0;
  let refIndex = 0;
  let effectIndex = 0;
  const state = [];
  const refs = [];
  const effects = [];
  let pendingEffects = [];
  const ReactMock = {
    useState(initial) {
      const index = stateIndex++;
      if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial;
      return [state[index], (value) => { state[index] = typeof value === 'function' ? value(state[index]) : value; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(callback, deps) {
      const index = effectIndex++;
      const previous = effects[index];
      const changed = !previous || !deps || deps.some((value, item) => !Object.is(value, previous.deps[item]));
      if (changed) pendingEffects.push({ index, callback, deps });
    },
  };
  function render(Component, props) {
    stateIndex = 0;
    refIndex = 0;
    effectIndex = 0;
    pendingEffects = [];
    const tree = Component(props);
    for (const effect of pendingEffects) {
      effects[effect.index]?.cleanup?.();
      effects[effect.index] = { deps: effect.deps, cleanup: effect.callback() };
    }
    return tree;
  }
  return { ReactMock, render };
}

const component = (name) => { const Component = () => null; Component.displayName = name; return Component; };
const native = {
  ActivityIndicator: component('ActivityIndicator'), Image: component('Image'), KeyboardAvoidingView: component('KeyboardAvoidingView'),
  Modal: component('Modal'), Platform: { OS: 'ios' }, Pressable: component('Pressable'), ScrollView: component('ScrollView'),
  StyleSheet: { create: (value) => value }, Text: component('Text'), TextInput: component('TextInput'), View: component('View'),
};
const Dummy = component('Dummy');
const theme = {
  colors: { white: '#fff', red: '#f33', cardDarker: '#210', cardLighter: '#321', primaryAccent: '#70f' },
  gradientDirection: { horizontal: {}, vertical: {} }, gradients: { background: ['#111', '#000'], purpleAccent: ['#b4f', '#80d'] },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 }, text: { title: {}, header: {}, body: {} },
};

function loadPolls(addDoc = async () => { throw new Error('unexpected write'); }) {
  return load('polls.ts', {
    'firebase/firestore': {
      addDoc,
      collection: (_db, ...segments) => ({ path: segments.join('/') }),
      serverTimestamp: () => ({ serverTimestamp: true }),
    },
    '@/config/firebase': { db: {} },
  });
}

function loadPollModal({ onPost = async () => assert.fail('unexpected post'), onClose = () => {} } = {}) {
  const hooks = createHooks();
  const { PollCreationModal } = load('PollCreationModal.tsx', {
    react: hooks.ReactMock,
    'react-native': native,
    '@expo/vector-icons': { Ionicons: Dummy },
    'expo-linear-gradient': { LinearGradient: Dummy },
    '@/theme': theme,
    '@/features/messages/polls': loadPolls(),
  });
  return { render: () => hooks.render(PollCreationModal, { visible: true, onPost, onClose }) };
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

const labelled = (label) => (element) => element.props.accessibilityLabel === label;
const input = (tree, label) => find(tree, native.TextInput, labelled(label));
const button = (tree, label) => find(tree, native.Pressable, labelled(label));
const findText = (tree, value) => find(tree, native.Text, (element) => element.props.children === value);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('Post stays disabled until a question and two different answers are entered', () => {
  const ui = loadPollModal();
  let tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);

  input(tree, 'Poll question').props.onChangeText('Party Theme');
  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);

  input(tree, 'Answer 1').props.onChangeText('Masquerade');
  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);

  input(tree, 'Answer 2').props.onChangeText('   ');
  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);

  input(tree, 'Answer 2').props.onChangeText('masquerade');
  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);
  assert.ok(findText(tree, 'Each answer must be different.'));

  input(tree, 'Answer 2').props.onChangeText('Great Gatsby');
  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, false);
  assert.equal(findText(tree, 'Each answer must be different.'), undefined);

  input(tree, 'Poll question').props.onChangeText('  ');
  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);
});

test('answer fields can be added and removed while keeping at least two', () => {
  const ui = loadPollModal();
  let tree = ui.render();
  assert.equal(button(tree, 'Remove answer 1').props.disabled, true);
  assert.equal(input(tree, 'Answer 3'), undefined);

  button(tree, 'Add answer').props.onPress();
  tree = ui.render();
  input(tree, 'Answer 1').props.onChangeText('A');
  input(tree, 'Answer 2').props.onChangeText('B');
  input(tree, 'Answer 3').props.onChangeText('C');
  tree = ui.render();
  assert.equal(button(tree, 'Remove answer 2').props.disabled, false);

  button(tree, 'Remove answer 2').props.onPress();
  tree = ui.render();
  assert.equal(input(tree, 'Answer 1').props.value, 'A');
  assert.equal(input(tree, 'Answer 2').props.value, 'C');
  assert.equal(input(tree, 'Answer 3'), undefined);

  for (let count = 2; count < 6; count++) {
    button(tree, 'Add answer').props.onPress();
    tree = ui.render();
  }
  assert.ok(input(tree, 'Answer 6'));
  assert.equal(button(tree, 'Add answer'), undefined);
});

test('Post sends the trimmed poll once, then closes and clears the pop-up', async () => {
  const posts = [];
  let closes = 0;
  let finishPost;
  const ui = loadPollModal({
    onPost: (question, options) => {
      posts.push([question, Array.from(options)]);
      return new Promise((resolve) => { finishPost = resolve; });
    },
    onClose: () => { closes++; },
  });
  let tree = ui.render();
  input(tree, 'Poll question').props.onChangeText('  Party Theme ');
  input(tree, 'Answer 1').props.onChangeText('Masquerade');
  input(tree, 'Answer 2').props.onChangeText(' Great Gatsby ');
  button(tree, 'Add answer').props.onPress();
  tree = ui.render();

  // A blank extra answer field is ignored rather than blocking the post.
  const post = button(tree, 'Post poll');
  assert.equal(post.props.disabled, false);
  post.props.onPress();
  post.props.onPress();
  assert.deepEqual(posts, [['Party Theme', ['Masquerade', 'Great Gatsby']]]);

  tree = ui.render();
  assert.equal(button(tree, 'Post poll').props.disabled, true);
  assert.equal(button(tree, 'Cancel poll').props.disabled, true);

  finishPost();
  await flush();
  assert.equal(closes, 1);

  tree = ui.render();
  assert.equal(input(tree, 'Poll question').props.value, '');
  assert.equal(input(tree, 'Answer 1').props.value, '');
  assert.equal(input(tree, 'Answer 2').props.value, '');
  assert.equal(input(tree, 'Answer 3'), undefined);
});

test('a failed post keeps the pop-up open with the entered text', async () => {
  let closes = 0;
  const ui = loadPollModal({
    onPost: async () => { throw new Error('Missing or insufficient permissions.'); },
    onClose: () => { closes++; },
  });
  let tree = ui.render();
  input(tree, 'Poll question').props.onChangeText('Party Theme');
  input(tree, 'Answer 1').props.onChangeText('Masquerade');
  input(tree, 'Answer 2').props.onChangeText('Great Gatsby');
  tree = ui.render();
  button(tree, 'Post poll').props.onPress();
  await flush();

  tree = ui.render();
  assert.equal(closes, 0);
  assert.ok(findText(tree, 'Missing or insufficient permissions.'));
  assert.equal(input(tree, 'Poll question').props.value, 'Party Theme');
  assert.equal(button(tree, 'Post poll').props.disabled, false);
});

test('canceling discards the entered text and posts nothing', () => {
  let closes = 0;
  const ui = loadPollModal({ onClose: () => { closes++; } });
  let tree = ui.render();
  input(tree, 'Poll question').props.onChangeText('Party Theme');
  input(tree, 'Answer 1').props.onChangeText('Masquerade');
  input(tree, 'Answer 2').props.onChangeText('Great Gatsby');
  button(tree, 'Add answer').props.onPress();
  tree = ui.render();

  button(tree, 'Cancel poll').props.onPress();
  assert.equal(closes, 1);
  tree = ui.render();
  assert.equal(input(tree, 'Poll question').props.value, '');
  assert.equal(input(tree, 'Answer 1').props.value, '');
  assert.equal(input(tree, 'Answer 2').props.value, '');
  assert.equal(input(tree, 'Answer 3'), undefined);

  // Android's back button closes the pop-up the same way.
  input(tree, 'Poll question').props.onChangeText('Dinner spot');
  tree = ui.render();
  find(tree, native.Modal).props.onRequestClose();
  assert.equal(closes, 2);
  tree = ui.render();
  assert.equal(input(tree, 'Poll question').props.value, '');
});

test('sendGroupPoll writes a trimmed poll message to the group chat', async () => {
  const writes = [];
  const polls = loadPolls(async (ref, data) => { writes.push({ path: ref.path, data: JSON.parse(JSON.stringify(data)) }); });

  await polls.sendGroupPoll('group1', 'alice', ' Party Theme ', ['Masquerade', '', ' Great Gatsby ']);
  assert.deepEqual(writes, [{
    path: 'groups/group1/messages',
    data: { senderId: 'alice', type: 'poll', question: 'Party Theme', options: ['Masquerade', 'Great Gatsby'], createdAt: { serverTimestamp: true } },
  }]);

  await assert.rejects(polls.sendGroupPoll('group1', 'alice', 'Party Theme', ['Only one']), /at least 2 answers/);
  await assert.rejects(polls.sendGroupPoll('group1', 'alice', ' ', ['A', 'B']), /Add a question/);
  assert.equal(writes.length, 1);
});

test('a posted poll renders as a Time to Vote card with its question and choices', () => {
  const { PollMessageCard } = load('PollMessageCard.tsx', { 'react-native': native, '@/theme': theme });
  const tree = PollMessageCard({ poll: { id: 'p1', senderId: 'bob', type: 'poll', question: 'Party Theme', options: ['Masquerade', 'Great Gatsby'], createdAt: null } });
  assert.ok(findText(tree, 'Time to Vote'));
  assert.ok(findText(tree, 'Party Theme'));
  assert.ok(findText(tree, 'Masquerade'));
  assert.ok(findText(tree, 'Great Gatsby'));
});

function loadConversation({ kind, messages = [], sendGroupPoll = async () => {} }) {
  const hooks = createHooks();
  const PollCreationModal = component('PollCreationModal');
  const PollMessageCard = component('PollMessageCard');
  const exports = load('screens/ConversationScreen.tsx', {
    react: hooks.ReactMock,
    'react-native': native,
    '@expo/vector-icons': { Ionicons: Dummy },
    'expo-linear-gradient': { LinearGradient: Dummy },
    'react-native-safe-area-context': { SafeAreaView: Dummy },
    'firebase/firestore': { doc: () => ({}), getDoc: async () => ({ exists: () => false }) },
    '@/config/firebase': { db: {} },
    '@/data/firestorePaths': { collections: { publicProfiles: 'publicProfiles' } },
    '@/features/auth/AuthContext': { useAuth: () => ({ user: { uid: 'alice' } }) },
    '@/features/auth/profilePhoto': { pickChatPhotoFromLibrary: async () => ({}) },
    '@/theme': theme,
    '../messages': {
      sendGroupMessage: async () => {},
      sendGroupPhoto: async () => {},
      watchGroupMessages: (_groupId, onChange) => { onChange(messages); return () => {}; },
    },
    '../polls': { sendGroupPoll },
    '../PollCreationModal': { PollCreationModal },
    '../PollMessageCard': { PollMessageCard },
    '../directMessages': {
      sendDirectMessage: async () => {},
      watchDirectMessages: (_conversationId, onChange) => { onChange(messages); return () => {}; },
    },
    '@/features/messages/directConversations': {
      watchDirectFriendship: (_uid, _otherUid, onChange) => { onChange(true); return () => {}; },
    },
  });
  const params = kind === 'group'
    ? { kind, title: 'Group1', memberIds: ['alice', 'bob'], groupId: 'group1' }
    : { kind, title: 'Bob', memberIds: ['alice', 'bob'], directConversationId: 'alice_bob' };
  const props = { navigation: { goBack() {} }, route: { params } };
  return { render: () => hooks.render(exports.ConversationScreen, props), PollCreationModal, PollMessageCard };
}

test('the plus menu opens poll creation and posted polls show in the group chat', async () => {
  const sent = [];
  const poll = { id: 'p1', senderId: 'bob', type: 'poll', question: 'Party Theme', options: ['Masquerade', 'Great Gatsby'], createdAt: null };
  const ui = loadConversation({ kind: 'group', messages: [poll], sendGroupPoll: async (...args) => { sent.push(args); } });
  // The first render subscribes to messages; the second shows them.
  ui.render();
  let tree = ui.render();
  assert.equal(find(tree, ui.PollMessageCard).props.poll.question, 'Party Theme');
  assert.equal(find(tree, ui.PollCreationModal).props.visible, false);
  assert.equal(button(tree, 'Create a poll'), undefined);

  button(tree, 'Add attachment').props.onPress();
  tree = ui.render();
  assert.ok(button(tree, 'Upload photo'));
  button(tree, 'Create a poll').props.onPress();
  tree = ui.render();
  assert.equal(find(tree, ui.PollCreationModal).props.visible, true);
  assert.equal(button(tree, 'Create a poll'), undefined);
  assert.equal(button(tree, 'Upload photo'), undefined);

  await find(tree, ui.PollCreationModal).props.onPost('Party Theme', ['Masquerade', 'Great Gatsby']);
  assert.deepEqual(sent, [['group1', 'alice', 'Party Theme', ['Masquerade', 'Great Gatsby']]]);

  find(tree, ui.PollCreationModal).props.onClose();
  tree = ui.render();
  assert.equal(find(tree, ui.PollCreationModal).props.visible, false);
});

test('friend chats offer photos but not polls in the plus menu', () => {
  const ui = loadConversation({ kind: 'friend' });
  ui.render();
  let tree = ui.render();

  button(tree, 'Add attachment').props.onPress();
  tree = ui.render();
  assert.ok(button(tree, 'Upload photo'));
  assert.equal(button(tree, 'Create a poll'), undefined);
});
