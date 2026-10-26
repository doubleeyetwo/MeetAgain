const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, '../../src/features/messages/groups.ts'), 'utf8');

function harness() {
  const records = new Map();
  const versions = new Map();
  let nextId = 1;
  const ref = (value) => ({ path: value, id: value.split('/').at(-1) });
  const snapshot = (reference) => {
    const data = records.get(reference.path);
    return { id: reference.id, exists: () => !!data, data: () => data && structuredClone(data) };
  };
  const adapter = {
    collection: (_db, name) => ref(name),
    doc: (parent, ...segments) => {
      if (typeof parent === 'string') return ref(segments.join('/'));
      if (segments.length === 0) return ref(`${parent.path}/${String(nextId++).padStart(20, '0')}`);
      return ref(`${parent.path}/${segments.join('/')}`);
    },
    getDoc: async (reference) => snapshot(reference),
    serverTimestamp: () => ({ __serverTimestamp: true }),
    runTransaction: async (_db, callback) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        const reads = new Map();
        const writes = new Map();
        const transaction = {
          get: async (reference) => {
            reads.set(reference.path, versions.get(reference.path) || 0);
            return snapshot(reference);
          },
          set: (reference, data) => writes.set(reference.path, structuredClone(data)),
        };
        const result = await callback(transaction);
        // Yield so two callers can both observe the old claim before either commits.
        await new Promise((resolve) => setImmediate(resolve));
        if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
        for (const [key, data] of writes) {
          if (records.has(key) && !key.startsWith('groupCounters/')) {
            throw new Error(`Unexpected overwrite: ${key}`);
          }
          for (const [field, value] of Object.entries(data)) {
            if (value?.__serverTimestamp) data[field] = { seconds: 1 };
          }
          records.set(key, data);
          versions.set(key, (versions.get(key) || 0) + 1);
        }
        return result;
      }
      throw new Error('Transaction retry limit exceeded');
    },
    query: (collectionRef, filter) => ({ path: collectionRef.path, filter }),
    where: (field, op, value) => ({ field, op, value }),
    onSnapshot: (queryRef, onChange) => {
      adapter.lastQuery = queryRef;
      onChange({ docs: [...records]
        .filter(([key, value]) => key.startsWith('groups/') && value.memberIds.includes(queryRef.filter.value))
        .map(([key]) => ({ id: ref(key).id, data: () => structuredClone(records.get(key)) })) });
      return () => {};
    },
  };
  const friendshipId = (a, b) => {
    if (!/^[A-Za-z0-9]{1,128}$/.test(a) || !/^[A-Za-z0-9]{1,128}$/.test(b)) throw new Error('Invalid UID');
    return [a, b].sort().join('_');
  };
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, {
    module,
    exports: module.exports,
    require: (name) => {
      if (name === 'firebase/firestore') return adapter;
      if (name === '@/config/firebase') return { db: 'db' };
      if (name === '@/features/friends/friendships') return { friendshipId };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  const accept = (a, b) => records.set(`friendships/${friendshipId(a, b)}`, {
    status: 'accepted', memberIds: [a, b].sort(),
  });
  return { ...module.exports, records, accept, adapter };
}

test('creates a random-ID group and reopens the exact member set without changing its data', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('alice', 'carol');
  const first = await h.createGroup('alice', ['carol', 'bob']);
  const second = await h.createGroup('bob', ['alice', 'carol']);
  assert.match(first.id, /^[0-9]{20}$/);
  assert.equal(second.id, first.id);
  assert.equal(second.name, 'Group1');
  assert.deepEqual([...first.memberIds], ['alice', 'bob', 'carol']);
  assert.deepEqual([...first.adminIds], ['alice']);
  assert.equal(first.createdBy, 'alice');
  assert.equal(h.records.size, 5); // two friendships, group, claim, creator counter, no user duplicates
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 1);
  assert.equal(h.records.has('groupCounters/bob'), false);
});

test('concurrent attempts for the same set converge on one group and counter increment', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const groups = await Promise.all([
    h.createGroup('alice', ['bob']),
    h.createGroup('alice', ['bob']),
    h.createGroup('alice', ['bob']),
  ]);
  assert.equal(new Set(groups.map((group) => group.id)).size, 1);
  assert.equal([...h.records.keys()].filter((key) => key.startsWith('groups/')).length, 1);
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 1);
  assert.equal(h.records.has('groupCounters/bob'), false);
});

test('different members racing to create the same set share one winning creator and counter', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const groups = await Promise.all([
    h.createGroup('alice', ['bob']),
    h.createGroup('bob', ['alice']),
  ]);
  assert.equal(groups[0].id, groups[1].id);
  assert.equal(groups[0].createdBy, groups[1].createdBy);
  assert.equal(groups[0].name, 'Group1');
  assert.deepEqual([...groups[0].adminIds], [groups[0].createdBy]);
  assert.equal([...h.records.keys()].filter((key) => key.startsWith('groups/')).length, 1);
  assert.equal([...h.records.keys()].filter((key) => key.startsWith('groupMemberships/')).length, 1);
  const counters = [...h.records.keys()].filter((key) => key.startsWith('groupCounters/'));
  assert.deepEqual(counters, [`groupCounters/${groups[0].createdBy}`]);
  assert.equal(h.records.get(counters[0]).latestNumber, 1);
});

test('new set advances default name; rejected or stale friendships leave no group', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('alice', 'carol');
  const first = await h.createGroup('alice', ['bob']);
  const second = await h.createGroup('alice', ['carol']);
  assert.equal(first.name, 'Group1');
  assert.equal(second.name, 'Group2');
  await assert.rejects(h.createGroup('alice', ['dave']), /accepted friend/);
  h.records.get('friendships/alice_carol').status = 'declined';
  await assert.rejects(h.createGroup('alice', ['bob', 'carol']), /accepted friend/);
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 2);
  assert.equal([...h.records.keys()].filter((key) => key.startsWith('groups/')).length, 2);
});

test('concurrent different sets by one creator receive different sequential names', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('alice', 'carol');
  const groups = await Promise.all([
    h.createGroup('alice', ['bob']),
    h.createGroup('alice', ['carol']),
  ]);
  assert.deepEqual(groups.map((group) => group.name).sort(), ['Group1', 'Group2']);
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 2);
});

test('rejects duplicate, creator, invalid, empty, and oversized selections', async () => {
  const h = harness();
  for (const ids of [[], ['alice'], ['bob', 'bob'], ['bad_uid']]) {
    await assert.rejects(h.createGroup('alice', ids));
  }
  await assert.rejects(h.createGroup('alice', Array.from({ length: 10 }, (_, index) => `friend${index}`)));
  assert.equal(h.records.size, 0);
});

test('permits the ten-member boundary when all nine selected friends are accepted', async () => {
  const h = harness();
  const friendIds = Array.from({ length: 9 }, (_, index) => `friend${index}`);
  for (const friendId of friendIds) h.accept('alice', friendId);
  const group = await h.createGroup('alice', friendIds);
  assert.equal(group.memberIds.length, 10);
  assert.equal(h.records.get(`groupMemberships/${group.memberIds.join('_')}`).groupId, group.id);
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 1);
});

test('membership feed uses array-contains and exposes only the signed-in member groups', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  await h.createGroup('alice', ['bob']);
  const seen = [];
  h.watchGroups('bob', (groups) => seen.push(groups), () => {});
  assert.deepEqual(h.adapter.lastQuery.filter, { field: 'memberIds', op: 'array-contains', value: 'bob' });
  assert.equal(seen[0].length, 1);
  h.watchGroups('outsider', (groups) => seen.push(groups), () => {});
  assert.equal(seen[1].length, 0);
});
