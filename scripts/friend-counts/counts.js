// Recount current records instead of applying event deltas: duplicate or
// out-of-order event deliveries cannot inflate or reverse the total.
async function refreshFriendCount(db, uid) {
  const summary = db.collection('friendCounts').doc(uid);
  await db.runTransaction(async (transaction) => {
    // Serialize concurrent recounts for this person, including the backfill.
    await transaction.get(summary);
    const pairs = await transaction.get(
      db.collection('friendships').where('memberIds', 'array-contains', uid),
    );
    const count = pairs.docs.filter((pair) => pair.data().status === 'accepted').length;
    transaction.set(summary, { count });
  });
}

function affectedMembers(before, after) {
  return [...new Set([before, after].flatMap((data) =>
    Array.isArray(data?.memberIds) ? data.memberIds.filter((uid) => typeof uid === 'string' && /^[A-Za-z0-9]{1,128}$/.test(uid)) : [],
  ))];
}

module.exports = { refreshFriendCount, affectedMembers };
