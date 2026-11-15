// Renders the real event screens with lightweight stand-ins for React Native,
// so a test can follow what a planner sees and taps without a device.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const React = require('react');
const ts = require('typescript');

const repoRoot = path.join(__dirname, '..', '..');

// Hook state for the component currently being rendered. Setters write here and
// the caller re-renders to see the next frame, the way React would.
let hookStates = [];
let hookIndex = 0;
let effectQueue = [];

function resetHooks() {
  hookStates = [];
  hookIndex = 0;
  effectQueue = [];
}

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

// Effects are collected during render and run only when the test asks, which
// keeps the first frame observable before any data arrives.
function useEffectStub(effect) {
  effectQueue.push(effect);
}

// Runs the effects queued by the last render and lets their promises settle.
// Returns the cleanups so a test can check an unmount path.
async function flushEffects() {
  const queued = effectQueue;
  effectQueue = [];
  const cleanups = queued.map((effect) => effect());

  // A screen that awaits a permission check and then a network call needs
  // several turns of the queue before its state has settled.
  for (let turn = 0; turn < 10; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  return cleanups;
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

// `repoRelativePath` is the screen under test. `extraModules` stubs the
// feature modules that screen imports, keyed by the exact import specifier.
function loadScreen(repoRelativePath, extraModules = {}) {
  const source = fs.readFileSync(
    path.join(repoRoot, repoRelativePath),
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
        if (id in extraModules) return extraModules[id];
        if (id === 'react/jsx-runtime') return require(id);
        if (id === 'react') {
          return { ...React, useState: useStateStub, useEffect: useEffectStub };
        }
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
    { filename: path.basename(repoRelativePath) }
  );

  return moduleForTest.exports;
}

// Loads a plain feature module, one with no JSX and no hooks, giving it its own
// globals. That is how the places service gets a stubbed fetch and a stubbed
// environment instead of billing a real search.
function loadModule(
  repoRelativePath,
  { modules = {}, globals = {} } = {}
) {
  const source = fs.readFileSync(
    path.join(repoRoot, repoRelativePath),
    'utf8'
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;

  const moduleForTest = { exports: {} };
  vm.runInNewContext(
    compiled,
    {
      module: moduleForTest,
      exports: moduleForTest.exports,
      console,
      require: (id) => (id in modules ? modules[id] : {}),
      ...globals,
    },
    { filename: path.basename(repoRelativePath) }
  );

  return moduleForTest.exports;
}

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

module.exports = {
  Text,
  TextInput,
  findByProp,
  findByType,
  findPressableShowing,
  flushEffects,
  host,
  loadModule,
  loadScreen,
  reactNative,
  render,
  resetHooks,
  theme,
  visibleText,
  walk,
};
