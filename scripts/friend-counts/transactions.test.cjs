const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual app service with an in-memory transactional Firestore
// adapter, so assertions cover its writes and stale-request guards.
function fixture(status = 'pending', counts = [2, 4]) {
  const pair = { id: 'alice_bob', memberIds: ['alice', 'bob'], requesterId: 'alice', recipientId: 'bob', status };
  const store = new Map([
    ['friendships/alice_bob', pair],
    ['friendCounts/alice', { count: counts[0] }],
    ['friendCounts/bob', { count: counts[1] }],
  ]);
  const sdk = {
    doc: (_db, collection, id) => `${collection}/${id}`,
    serverTimestamp: () => 'server-time',
    async runTransaction(_db, callback) {
      const writes = [];
      await callback({
        async get(ref) {
          assert.equal(writes.length, 0, 'all reads precede writes');
          const data = store.get(ref);
          return { id: ref.split('/').pop(), exists: () => !!data, data: () => data };
        },
        update: (ref, fields) => writes.push(() => store.set(ref, { ...store.get(ref), ...fields })),
        delete: (ref) => writes.push(() => store.delete(ref)),
      });
      writes.forEach((write) => write());
    },
  };
  const loadService = (file, exposeAccountHelper = false) => {
    const context = { exports: {}, require: (name) => {
    if (name === 'firebase/firestore') return sdk;
    if (name === 'firebase/auth') return { deleteUser: async () => {}, getIdTokenResult: async () => ({ claims: {} }) };
    if (name === '@/config/firebase') return { db: {}, auth: { currentUser: null } };
    throw new Error(`Unexpected dependency: ${name}`);
    } };
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    let compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    if (exposeAccountHelper) compiled += '\nexports.__testRemoveAccountFriendship = removeAccountFriendship;';
    vm.runInNewContext(compiled, context);
    return context.exports;
  };
  const service = loadService('../../src/features/friends/friendships.ts');
  const deletionService = loadService('../../src/features/profile/deleteAccount.ts', true);
  return { service, removeAccountFriendship: deletionService.__testRemoveAccountFriendship, pair, store };
}

test('accept updates both totals once and rejects a stale repeat', async () => {
  const { service, pair, store } = fixture();
  await service.respondToFriendRequest(pair, 'bob', 'accepted');
  assert.equal(store.get('friendCounts/alice').count, 3);
  assert.equal(store.get('friendCounts/bob').count, 5);
  assert.equal(store.get('friendCounts/bob').lastPairId, pair.id);
  await assert.rejects(service.respondToFriendRequest(pair, 'bob', 'accepted'), /no longer pending/);
  assert.equal(store.get('friendCounts/bob').count, 5);
});

test('declining leaves totals unchanged', async () => {
  const { service, pair, store } = fixture();
  await service.respondToFriendRequest(pair, 'bob', 'declined');
  assert.equal(store.get('friendCounts/alice').count, 2);
  assert.equal(store.get('friendCounts/bob').count, 4);
});

test('unfriend updates both totals and cannot be repeated', async () => {
  const { service, pair, store } = fixture('accepted', [1, 1]);
  await service.removeFriendship(pair, 'alice');
  assert.equal(store.get('friendCounts/alice').count, 0);
  assert.equal(store.get('friendCounts/bob').count, 0);
  assert.equal(store.has('friendships/alice_bob'), false);
  await assert.rejects(service.removeFriendship(pair, 'alice'), /no longer exists/);
});

test('account deletion removes every pair status and only decrements accepted counts', async () => {
  for (const status of ['pending', 'declined', 'accepted']) {
    const { removeAccountFriendship, store } = fixture(status, [2, 4]);
    await removeAccountFriendship('alice_bob', 'alice');
    assert.equal(store.has('friendships/alice_bob'), false);
    assert.equal(store.get('friendCounts/alice').count, status === 'accepted' ? 1 : 2);
    assert.equal(store.get('friendCounts/bob').count, status === 'accepted' ? 3 : 4);
    await removeAccountFriendship('alice_bob', 'alice');
  }
});

test('missing baseline and unauthorized actions leave all records unchanged', async () => {
  const { service, pair, store } = fixture();
  store.delete('friendCounts/alice');
  await assert.rejects(service.respondToFriendRequest(pair, 'bob', 'accepted'), /initialized/);
  assert.equal(store.get('friendships/alice_bob').status, 'pending');
  assert.equal(store.get('friendCounts/bob').count, 4);
  await assert.rejects(service.respondToFriendRequest(pair, 'alice', 'accepted'), /recipient/);
  await assert.rejects(service.removeFriendship(pair, 'outsider'), /Only a friend/);
});
