const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldPath } = require('firebase-admin/firestore');
const { refreshFriendCount, affectedMembers } = require('./counts');

// Explicit project prevents accidentally targeting the CLI's default project.
const projectId = process.argv[2];
if (!projectId) throw new Error('Usage: npm run backfill -- FIREBASE_PROJECT_ID');
initializeApp({ projectId });
const db = getFirestore();

async function scan(name, visit) {
  let cursor;
  for (;;) {
    let query = db.collection(name).orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const document of page.docs) await visit(document);
    cursor = page.docs[page.docs.length - 1];
  }
}

(async () => {
  await scan('users', (document) => refreshFriendCount(db, document.id));
  // Include pairs whose accounts have no users document (older/imported data).
  await scan('friendships', async (document) => {
    for (const uid of affectedMembers(undefined, document.data())) await refreshFriendCount(db, uid);
  });
  console.log('Friend count backfill complete.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
