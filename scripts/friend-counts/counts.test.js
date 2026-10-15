const { test } = require('node:test');
const assert = require('node:assert/strict');
const { refreshFriendCount, affectedMembers } = require('./counts');

test('accepted friendships count once; replay and removal recount current data', async () => {
  let statuses = ['accepted', 'pending', 'declined', 'accepted'];
  let stored;
  const summary = {};
  const query = {};
  const db = {
    collection(name) {
      if (name === 'friendCounts') return { doc: () => summary };
      assert.equal(name, 'friendships');
      return { where: (field, operator, uid) => {
        assert.deepEqual([field, operator, uid], ['memberIds', 'array-contains', 'alice']);
        return query;
      } };
    },
    async runTransaction(callback) {
      const reads = [];
      await callback({
        async get(ref) {
          reads.push(ref);
          if (ref === summary) return {};
          assert.equal(reads[0], summary);
          return { docs: statuses.map((status) => ({ data: () => ({ status }) })) };
        },
        set(ref, value) {
          assert.equal(ref, summary);
          assert.equal(reads.length, 2);
          stored = value.count;
        },
      });
    },
  };
  await refreshFriendCount(db, 'alice');
  assert.equal(stored, 2);
  await refreshFriendCount(db, 'alice'); // Duplicate event delivery.
  assert.equal(stored, 2);
  statuses = ['pending', 'declined']; // Both accepted pairs have been removed.
  await refreshFriendCount(db, 'alice');
  assert.equal(stored, 0);
  statuses = ['accepted', 'declined']; // Incoming request was accepted.
  await refreshFriendCount(db, 'alice');
  assert.equal(stored, 1);
});

test('creation and deletion refresh both members, without duplicate work', () => {
  const pair = { memberIds: ['alice', 'bob'] };
  assert.deepEqual(affectedMembers(undefined, pair), ['alice', 'bob']);
  assert.deepEqual(affectedMembers(pair, undefined), ['alice', 'bob']);
  assert.deepEqual(affectedMembers(pair, pair), ['alice', 'bob']);
  assert.deepEqual(affectedMembers({ memberIds: ['../bad', null] }, undefined), []);
});
