const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Load the real provider with small Firebase/React fakes so auth routing can be
// checked without an emulator, browser, or test-only app dependencies.
function providerHarness(initialProfiles = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/auth/AuthContext.tsx'), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const profiles = new Map(Object.entries(initialProfiles));
  const usernames = new Map();
  const auth = { currentUser: null };
  let authChanged;
  let popupUser;
  let popupFailure;
  let transactionFailure;
  let slots = [];
  let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => undefined,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(callback) {
      const index = cursor++;
      if (!(index in slots)) { slots[index] = true; callback(); }
    },
  };
  const snapshot = (ref) => {
    const value = (ref.collection === 'users' ? profiles : usernames).get(ref.id);
    return { exists: () => value !== undefined, data: () => value };
  };
  const mocks = {
    react,
    'react/jsx-runtime': { jsx: (_type, props) => ({ props }) },
    'react-native': { Platform: { OS: 'web' } },
    'firebase/auth': {
      GoogleAuthProvider: class {},
      onAuthStateChanged: (_auth, callback) => { authChanged = callback; return () => {}; },
      signInWithPopup: async () => {
        if (popupFailure) throw popupFailure;
        auth.currentUser = popupUser;
        await authChanged(popupUser);
        return { user: popupUser };
      },
      signOut: async () => { auth.currentUser = null; await authChanged(null); },
      createUserWithEmailAndPassword: async () => { throw Error('Unexpected password signup'); },
    },
    'firebase/firestore': {
      doc: (_db, collection, id) => ({ collection, id }),
      getDoc: async (ref) => snapshot(ref),
      runTransaction: async (_db, callback) => {
        if (transactionFailure) throw transactionFailure;
        const writes = [];
        const result = await callback({
          get: async (ref) => snapshot(ref),
          set: (ref, value) => writes.push({ ref, value }),
          update: (ref, value) => writes.push({ ref, value: { ...snapshot(ref).data(), ...value } }),
        });
        for (const { ref, value } of writes) {
          (ref.collection === 'users' ? profiles : usernames).set(ref.id, value);
        }
        return result;
      },
      serverTimestamp: () => 'server-time',
    },
    '@/config/firebase': { auth, db: {} },
    './profilePhoto': { PROFILE_PHOTO_JPEG_PREFIX: 'data:image/jpeg;base64,', PROFILE_PHOTO_MAX_DATA_URL_LENGTH: 200023 },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require: (name) => {
      if (!(name in mocks)) throw Error(`Unmocked import: ${name}`);
      return mocks[name];
    },
  }, { filename: 'AuthContext.tsx' });
  const render = () => {
    cursor = 0;
    return module.exports.AuthProvider({ children: null }).props.value;
  };
  render();
  return {
    auth,
    profiles,
    usernames,
    render,
    restore: async (user) => { auth.currentUser = user; await authChanged(user); },
    popupAs: (user) => { popupUser = user; },
    failPopup: (error) => { popupFailure = error; },
    failTransactions: (error) => { transactionFailure = error; },
  };
}

const googleUser = { uid: 'google-1', email: 'person@example.com' };
const validProfile = {
  firstName: 'Ada', lastName: 'Lovelace', displayName: 'Ada Lovelace',
  username: 'ada_l', dateOfBirth: '1990-01-01',
};

test('first Google sign-in creates an incomplete user and only Join admits Home', async () => {
  const app = providerHarness();
  app.popupAs(googleUser);
  await app.render().signInWithGoogle();
  assert.equal(app.render().user, null);
  assert.equal(app.render().profilePending, true);
  assert.equal(app.profiles.get(googleUser.uid).profileComplete, false);
  assert.equal(app.profiles.get(googleUser.uid).username, undefined);

  await app.render().createAccount(validProfile);
  assert.equal(app.render().user.uid, googleUser.uid);
  assert.equal(app.render().profilePending, false);
  assert.equal(app.profiles.get(googleUser.uid).profileComplete, true);
  assert.equal(app.usernames.get('ada_l').uid, googleUser.uid);
});

test('restored incomplete profile stays in setup; completed and legacy profiles enter Home', async () => {
  const app = providerHarness({
    [googleUser.uid]: { id: googleUser.uid, email: googleUser.email, profileComplete: false },
  });
  await app.restore(googleUser);
  assert.equal(app.render().user, null);
  assert.equal(app.render().profilePending, true);

  app.profiles.set(googleUser.uid, { profileComplete: true });
  await app.restore(googleUser);
  assert.equal(app.render().user.uid, googleUser.uid);

  app.profiles.set(googleUser.uid, { displayName: 'Legacy User' });
  await app.restore(googleUser);
  assert.equal(app.render().user.uid, googleUser.uid);
  await app.restore(null);
  assert.equal(app.render().signedOut, true);
  assert.equal(app.render().user, null);
});

test('returning Google account with completed profile enters Home without rewriting it', async () => {
  const saved = { id: googleUser.uid, profileComplete: true, username: 'ada_l' };
  const app = providerHarness({ [googleUser.uid]: saved });
  app.popupAs(googleUser);
  await app.render().signInWithGoogle();
  assert.equal(app.render().user.uid, googleUser.uid);
  assert.equal(app.render().profilePending, false);
  assert.equal(app.profiles.get(googleUser.uid), saved);
});

test('failed profile creation signs out the popup account and never enters Home', async () => {
  const app = providerHarness();
  app.popupAs(googleUser);
  app.failTransactions(Error('offline'));
  await assert.rejects(app.render().signInWithGoogle(), /offline/);
  assert.equal(app.auth.currentUser, null);
  assert.equal(app.render().user, null);
  assert.equal(app.render().profilePending, false);
  assert.equal(app.profiles.has(googleUser.uid), false);
});

test('cancelled popup leaves auth and profile unchanged with a clear message', async () => {
  const app = providerHarness();
  const cancelled = Object.assign(Error('cancelled'), { code: 'auth/popup-closed-by-user' });
  app.failPopup(cancelled);
  await assert.rejects(app.render().signInWithGoogle(), { code: 'auth/popup-closed-by-user' });
  assert.equal(app.auth.currentUser, null);
  assert.equal(app.render().profilePending, false);
  assert.equal(app.profiles.size, 0);

  const source = fs.readFileSync(path.join(__dirname, '../src/features/auth/googleSignInError.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports });
  assert.equal(module.exports.googleSignInError(cancelled), 'Google sign-in was cancelled.');
});

test('Google sign-in errors show useful Firebase codes without exposing raw messages', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/features/auth/googleSignInError.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports });
  const explain = module.exports.googleSignInError;

  assert.equal(
    explain(Object.assign(Error('sensitive details'), { code: 'auth/unknown_error' })),
    'Could not sign in with Google (auth/unknown_error). Please try again.',
  );
  assert.equal(
    explain(Object.assign(Error('sensitive details'), { code: 'auth/permission denied' })),
    'Could not sign in with Google. Please try again.',
  );
  assert.equal(explain(Error('sensitive details')), 'Could not sign in with Google. Please try again.');
  assert.equal(
    explain(Object.assign(Error('internal detail'), { code: 'auth/internal-error' })),
    'Google sign-in hit an internal error. Reload the browser and try again.',
  );
  assert.equal(
    explain(Object.assign(Error('rule detail'), { code: 'permission-denied' })),
    'Your profile could not be saved because Firestore rules denied the write. Check the published rules and try again.',
  );
});
