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
        // Track explicit updates separately from document creation.
        const updates = new Set();
        const transaction = {
          get: async (reference) => {
            reads.set(reference.path, versions.get(reference.path) || 0);
            return snapshot(reference);
          },
          set: (reference, data) => writes.set(reference.path, structuredClone(data)),
          update: (reference, changes) => {
            const existing = writes.get(reference.path) || records.get(reference.path);
            if (!existing) throw new Error('Cannot update a missing document');

            // Merge changed fields so names, admins, and creation time survive.
            writes.set(reference.path, {
              ...structuredClone(existing),
              ...structuredClone(changes),
            });
            updates.add(reference.path);
          },
        };
        const result = await callback(transaction);
        // Yield so concurrent callers can read the same version before committing.
        await new Promise((resolve) => setImmediate(resolve));
        if ([...reads].some(([key, version]) => (versions.get(key) || 0) !== version)) continue;
        for (const [key, data] of writes) {
          if (records.has(key) && !key.startsWith('groupCounters/') && !updates.has(key)) {
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

test('creates separate groups for the same members', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('alice', 'carol');

  const first = await h.createGroup('alice', ['carol', 'bob']);
  const second = await h.createGroup('alice', ['bob', 'carol']);

  // Each request creates a separate conversation with its own default name.
  assert.notEqual(second.id, first.id);
  assert.equal(first.name, 'Group1');
  assert.equal(second.name, 'Group2');

  // Assert that both groups contain alice, bob, and carol.
  assert.deepEqual([...first.memberIds], ['alice', 'bob', 'carol']);
  assert.deepEqual([...second.memberIds], ['alice', 'bob', 'carol']);

  // The counter should identify the most recently created group.
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 2);
  assert.equal(h.records.get('groupCounters/alice').lastGroupId, second.id);

  // Creating groups should no longer reserve a unique membership claim.
  assert.equal(
    [...h.records.keys()].some((key) => key.startsWith('groupMemberships/')),
    false,
  );
});

test('concurrent creations with identical members produce separate numbered groups', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const groups = await Promise.all([
    h.createGroup('alice', ['bob']),
    h.createGroup('alice', ['bob']),
    h.createGroup('alice', ['bob']),
  ]);
  // Concurrent requests must create three distinct stored conversations.
  assert.equal(new Set(groups.map((group) => group.id)).size, 3);
  assert.equal(
    [...h.records.keys()].filter((key) => key.startsWith('groups/')).length,
    3,
  );

  // Completion order can vary, but each request must receive a unique sequential name.
  assert.deepEqual(
    groups.map((group) => group.name).sort(),
    ['Group1', 'Group2', 'Group3'],
  );
  assert.equal(h.records.get('groupCounters/alice').latestNumber, 3);
  assert.equal(h.records.has('groupCounters/bob'), false);
});

test('different creators independently create groups with identical members', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const groups = await Promise.all([
    h.createGroup('alice', ['bob']),
    h.createGroup('bob', ['alice']),
  ]);
  // Each creator gets a separate conversation, even with identical members.
  assert.notEqual(groups[0].id, groups[1].id);
  assert.equal(
    [...h.records.keys()].filter((key) => key.startsWith('groups/')).length,
    2,
  );

  // Naming and administrator assignment belong to each group's creator.
  for (const [index, creator] of ['alice', 'bob'].entries()) {
    const group = groups[index];
    assert.equal(group.createdBy, creator);
    assert.deepEqual([...group.adminIds], [creator]);
    assert.deepEqual([...group.memberIds], ['alice', 'bob']);
    assert.equal(group.name, 'Group1');
    assert.equal(h.records.get(`groupCounters/${creator}`).latestNumber, 1);
    assert.equal(h.records.get(`groupCounters/${creator}`).lastGroupId, group.id);
  }

  assert.equal(
    [...h.records.keys()].some((key) => key.startsWith('groupMemberships/')),
    false,
  );
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
    assert.equal(h.records.get('groupCounters/alice').lastGroupId, group.id);
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

test('a non-admin removes another member without replacing the conversation', async () => {
  // Arrange: Alice is admin; Bob and Carol are ordinary members.
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('alice', 'carol');

  const group = await h.createGroup('alice', ['bob', 'carol']);
  const groupPath = `groups/${group.id}`;
  const before = structuredClone(h.records.get(groupPath));

  // Seed history so this test can verify it survives membership changes.
  const messagePath = `${groupPath}/messages/existing`;
  const message = {
    senderId: 'alice',
    text: 'Keep this history',
    createdAt: { seconds: 1 },
  };
  h.records.set(messagePath, structuredClone(message));

  // Act: Bob removes Carol.
  await h.removeGroupMember(group.id, 'bob', 'carol');

  // Assert: inspect the original document, not a newly created conversation.
  const after = h.records.get(groupPath);
  assert.ok(after);
  assert.deepEqual([...after.memberIds], ['alice', 'bob']);

  assert.equal(after.name, before.name);
  assert.deepEqual(after.adminIds, before.adminIds);
  assert.equal(after.createdBy, before.createdBy);
  assert.deepEqual(after.createdAt, before.createdAt);

  assert.deepEqual(h.records.get(messagePath), message);
  assert.equal(
    [...h.records.keys()].filter((key) => /^groups\/[^/]+$/.test(key)).length,
    1,
  );
});

test('rejects invalid removals without changing the group', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('alice', 'carol');

  const group = await h.createGroup('alice', ['bob', 'carol']);
  const groupPath = `groups/${group.id}`;
  const before = structuredClone(h.records.get(groupPath));

  // An outsider cannot change membership.
  await assert.rejects(
    h.removeGroupMember(group.id, 'outsider', 'carol'),
    /not part of this group/,
  );

  await assert.rejects(
    h.removeGroupMember(group.id, 'bob', 'bob'),
    /kick yourself/,
  );

  // The admin is protected from removal.
  await assert.rejects(
    h.removeGroupMember(group.id, 'bob', 'alice'),
    /admin/,
  );

  // A stale request cannot remove someone who is no longer present.
  await assert.rejects(
    h.removeGroupMember(group.id, 'bob', 'dave'),
    /no longer a member/,
  );

  // Rejected operations must leave every stored group field unchanged.
  assert.deepEqual(h.records.get(groupPath), before);
});

test('concurrent removals preserve both membership changes', async () => {
  const h = harness();
  for (const friend of ['bob', 'carol', 'dave']) {
    h.accept('alice', friend);
  }

  const group = await h.createGroup('alice', ['bob', 'carol', 'dave']);

  // Bob remains a member while independently removing Carol and Dave.
  await Promise.all([
    h.removeGroupMember(group.id, 'bob', 'carol'),
    h.removeGroupMember(group.id, 'bob', 'dave'),
  ]);

  const after = h.records.get(`groups/${group.id}`);

  // Both removals must survive, regardless of which transaction commits first.
  assert.deepEqual([...after.memberIds], ['alice', 'bob']);
});

test('rejects removal from a missing group', async () => {
  const h = harness();

  await assert.rejects(
    h.removeGroupMember('missingGroup', 'bob', 'carol'),
    /unavailable/,
  );

  // A failed removal must not create any records.
  assert.equal(h.records.size, 0);
});

test('non-admin adds their own friends while preserving group history and metadata', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('bob', 'carol');
  const group = await h.createGroup('alice', ['bob']);
  const groupPath = `groups/${group.id}`;
  const before = structuredClone(h.records.get(groupPath));
  const messagePath = `${groupPath}/messages/old`;
  h.records.set(messagePath, { text: 'Keep me' });
  const counter = structuredClone(h.records.get('groupCounters/alice'));
  await h.addGroupMembers(group.id, 'bob', ['carol']);
  const after = h.records.get(groupPath);
  assert.deepEqual([...after.memberIds], ['alice', 'bob', 'carol']);
  for (const field of ['name', 'createdBy', 'adminIds', 'createdAt']) {
    assert.deepEqual(after[field], before[field]);
  }
  assert.deepEqual(h.records.get(messagePath), { text: 'Keep me' });
  assert.deepEqual(h.records.get('groupCounters/alice'), counter);
});

test('rejects invalid additions without modifying the group', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('bob', 'carol');
  const group = await h.createGroup('alice', ['bob']);
  const before = structuredClone(h.records.get(`groups/${group.id}`));
  for (const ids of [[], ['carol', 'carol'], ['bob'], ['alice'], ['bad_uid'], ['dave']]) {
    await assert.rejects(h.addGroupMembers(group.id, 'bob', ids));
  }
  await assert.rejects(h.addGroupMembers(group.id, 'outsider', ['carol']), /not part/);
  h.records.get('friendships/bob_carol').status = 'declined';
  await assert.rejects(h.addGroupMembers(group.id, 'bob', ['carol']), /accepted friend/);
  await assert.rejects(h.addGroupMembers('missing', 'bob', ['carol']), /unavailable/);
  assert.deepEqual(h.records.get(`groups/${group.id}`), before);
});

test('concurrent additions merge without losing either member', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  h.accept('bob', 'carol');
  h.accept('bob', 'dave');
  const group = await h.createGroup('alice', ['bob']);
  await Promise.all([
    h.addGroupMembers(group.id, 'bob', ['carol']),
    h.addGroupMembers(group.id, 'bob', ['dave']),
  ]);
  assert.deepEqual([...h.records.get(`groups/${group.id}`).memberIds], ['alice', 'bob', 'carol', 'dave']);
});

test('only one concurrent addition can take the last available slot', async () => {
  const h = harness();
  const existing = Array.from({ length: 8 }, (_, i) => `friend${i}`);
  for (const friend of [...existing, 'newA', 'newB']) h.accept('alice', friend);
  const group = await h.createGroup('alice', existing);
  const results = await Promise.allSettled([
    h.addGroupMembers(group.id, 'alice', ['newA']),
    h.addGroupMembers(group.id, 'alice', ['newB']),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(h.records.get(`groups/${group.id}`).memberIds.length, 10);
});

test('a one-member group can grow to ten without creating a conversation', async () => {
  const h = harness();
  const friends = Array.from({ length: 9 }, (_, i) => `friend${i}`);
  for (const friend of friends) h.accept('alice', friend);
  const group = await h.createGroup('alice', ['friend0']);
  await h.removeGroupMember(group.id, 'alice', 'friend0');
  await h.addGroupMembers(group.id, 'alice', friends);
  assert.equal(h.records.get(`groups/${group.id}`).memberIds.length, 10);
  await assert.rejects(h.addGroupMembers(group.id, 'alice', ['extra']));
});

test('a member renames the group without changing its other fields', async () => {
  const h = harness();
  h.accept('alice', 'bob');

  const group = await h.createGroup('alice', ['bob']);
  const groupPath = `groups/${group.id}`;
  const before = structuredClone(h.records.get(groupPath));

  // Bob is not the admin, but any current member may rename the group.
  await h.renameGroup(group.id, 'bob', '  Study Group  ');

  const after = h.records.get(groupPath);
  assert.equal(after.name, 'Study Group');
  assert.deepEqual(before.memberIds, after.memberIds);
  assert.deepEqual(before.adminIds, after.adminIds);
  assert.equal(before.createdBy, after.createdBy);
  assert.deepEqual(before.createdAt, after.createdAt);
});

test('photo-only settings preserve the existing name and other group fields', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);
  const before = structuredClone(h.records.get(`groups/${group.id}`));
  const photoDataUrl = 'data:image/jpeg;base64,Zm9v';

  await h.updateGroupSettings(group.id, 'bob', { photoDataUrl });

  const after = h.records.get(`groups/${group.id}`);
  assert.equal(after.name, before.name);
  assert.equal(after.photoDataUrl, photoDataUrl);
  for (const field of ['memberIds', 'adminIds', 'createdBy', 'createdAt']) {
    assert.deepEqual(after[field], before[field]);
  }
});

test('combined group settings update name and photo together', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);
  const photoDataUrl = 'data:image/jpeg;base64,YmFy';

  await h.updateGroupSettings(group.id, 'bob', {
    name: '  Weekend plans  ',
    photoDataUrl,
  });

  const after = h.records.get(`groups/${group.id}`);
  assert.equal(after.name, 'Weekend plans');
  assert.equal(after.photoDataUrl, photoDataUrl);
});

test('renaming a group retains its existing photo', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);
  const photoDataUrl = 'data:image/jpeg;base64,cGhvdG8=';
  h.records.get(`groups/${group.id}`).photoDataUrl = photoDataUrl;

  await h.renameGroup(group.id, 'bob', 'New name');

  const after = h.records.get(`groups/${group.id}`);
  assert.equal(after.name, 'New name');
  assert.equal(after.photoDataUrl, photoDataUrl);
});

test('rejects invalid and oversized group photos without changing settings', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);
  const groupPath = `groups/${group.id}`;
  const before = structuredClone(h.records.get(groupPath));
  for (const photoDataUrl of [
    '',
    'data:image/png;base64,Zm9v',
    'data:image/jpeg;base64,',
    'data:image/jpeg;base64,Zm9v*',
    `data:image/jpeg;base64,${'A'.repeat(200_001)}`,
  ]) {
    await assert.rejects(h.updateGroupSettings(group.id, 'bob', { photoDataUrl }));
  }
  assert.deepEqual(h.records.get(groupPath), before);
});

test('requires group membership and an existing group when updating settings', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);
  const before = structuredClone(h.records.get(`groups/${group.id}`));

  await assert.rejects(
    h.updateGroupSettings(group.id, 'outsider', { photoDataUrl: 'data:image/jpeg;base64,Zm9v' }),
    /not part of this group/,
  );
  await assert.rejects(
    h.updateGroupSettings('missingGroup', 'bob', { photoDataUrl: 'data:image/jpeg;base64,Zm9v' }),
    /unavailable/,
  );
  assert.deepEqual(h.records.get(`groups/${group.id}`), before);
  assert.equal(h.records.has('groups/missingGroup'), false);
});

test('accepts a group photo data URL at the maximum total length', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);
  const photoDataUrl = `data:image/jpeg;base64,${'A'.repeat(200_000)}`;
  assert.equal(photoDataUrl.length, 200_023);

  await h.updateGroupSettings(group.id, 'bob', { photoDataUrl });

  assert.equal(h.records.get(`groups/${group.id}`).photoDataUrl, photoDataUrl);
});

test('rejects invalid renames without changing the group', async () => {
  const h = harness();
  h.accept('alice', 'bob');

  const group = await h.createGroup('alice', ['bob']);
  const groupPath = `groups/${group.id}`;
  const before = structuredClone(h.records.get(groupPath));

  // Invalid names must fail before any document is changed.
  for (const name of ['', '   ', 'x'.repeat(81)]) {
    await assert.rejects(h.renameGroup(group.id, 'bob', name));
  }

  await assert.rejects(
    h.renameGroup(group.id, 'outsider', 'New name'),
    /not part of this group/,
  );

  await assert.rejects(
    h.renameGroup('missingGroup', 'bob', 'New name'),
    /unavailable/,
  );

  // Check every stored field, not just the name.
  assert.deepEqual(h.records.get(groupPath), before);
});

test('accepts a group name of exactly 80 characters', async () => {
  const h = harness();
  h.accept('alice', 'bob');
  const group = await h.createGroup('alice', ['bob']);

  const name = 'x'.repeat(80);
  await h.renameGroup(group.id, 'bob', name);

  // Read the original group document to verify the maximum-length name persisted.
  const after = h.records.get(`groups/${group.id}`);
  assert.equal(after.name, name);
});
