
const fs = require("node:fs");
const { test, after } = require("node:test");

const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  Timestamp,
} = require("firebase/firestore");

const projectId = "demo-meetagain-freenow-test";

let testEnv;

async function setup() {
  if (!testEnv) {
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: fs.readFileSync("firestore.rules", "utf8"),
      },
    });

    await testEnv.clearFirestore();
  }

  return testEnv;
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function expiresIn(milliseconds) {
  return { expiresAt: Timestamp.fromDate(new Date(Date.now() + milliseconds)) };
}

// The pair document ID is the two UIDs sorted, matching friendshipId().
async function writeFriendship(env, first, second, status) {
  const memberIds = [first, second].sort();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "friendships", memberIds.join("_")),
      { memberIds, status, requesterId: first, recipientId: second }
    );
  });
}

test("a signed in user can mark themselves free", async () => {
  const env = await setup();
  const aliceDb = env.authenticatedContext("alice").firestore();

  await assertSucceeds(
    setDoc(doc(aliceDb, "freeNow", "alice"), expiresIn(TWO_HOURS_MS))
  );
});

test("an accepted friend can see that status", async () => {
  const env = await setup();
  await writeFriendship(env, "alice", "bob", "accepted");

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "freeNow", "alice"),
      expiresIn(TWO_HOURS_MS)
    );
  });

  const bobDb = env.authenticatedContext("bob").firestore();

  await assertSucceeds(getDoc(doc(bobDb, "freeNow", "alice")));
});

test("turning it off removes the status, and the friend sees nothing", async () => {
  const env = await setup();
  await writeFriendship(env, "alice", "dana", "accepted");

  const aliceDb = env.authenticatedContext("alice").firestore();
  await assertSucceeds(
    setDoc(doc(aliceDb, "freeNow", "alice"), expiresIn(TWO_HOURS_MS))
  );

  // Toggling off is a delete, so nothing expired is left behind to read.
  await assertSucceeds(deleteDoc(doc(aliceDb, "freeNow", "alice")));

  const danaDb = env.authenticatedContext("dana").firestore();
  const seen = await getDoc(doc(danaDb, "freeNow", "alice"));

  if (seen.exists()) {
    throw new Error("the status should be gone after it is toggled off");
  }
});

test("someone who is not a friend cannot see the status", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "freeNow", "alice"),
      expiresIn(TWO_HOURS_MS)
    );
  });

  const strangerDb = env.authenticatedContext("stranger").firestore();

  await assertFails(getDoc(doc(strangerDb, "freeNow", "alice")));
});

test("a pending or declined request does not grant a look", async () => {
  const env = await setup();
  await writeFriendship(env, "alice", "erin", "pending");
  await writeFriendship(env, "alice", "frank", "declined");

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "freeNow", "alice"),
      expiresIn(TWO_HOURS_MS)
    );
  });

  const erinDb = env.authenticatedContext("erin").firestore();
  const frankDb = env.authenticatedContext("frank").firestore();

  await assertFails(getDoc(doc(erinDb, "freeNow", "alice")));
  await assertFails(getDoc(doc(frankDb, "freeNow", "alice")));
});

test("a signed out visitor cannot see the status", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "freeNow", "alice"),
      expiresIn(TWO_HOURS_MS)
    );
  });

  const anonDb = env.unauthenticatedContext().firestore();

  await assertFails(getDoc(doc(anonDb, "freeNow", "alice")));
});

test("nobody can mark someone else free, friend or not", async () => {
  const env = await setup();
  await writeFriendship(env, "alice", "bob", "accepted");

  const bobDb = env.authenticatedContext("bob").firestore();

  await assertFails(
    setDoc(doc(bobDb, "freeNow", "alice"), expiresIn(TWO_HOURS_MS))
  );
  await assertFails(deleteDoc(doc(bobDb, "freeNow", "alice")));
});

test("the status cannot outlast its two hour window", async () => {
  const env = await setup();
  const aliceDb = env.authenticatedContext("alice").firestore();

  // A client cannot claim to be free all week.
  await assertFails(
    setDoc(doc(aliceDb, "freeNow", "alice"), expiresIn(7 * 24 * 60 * 60 * 1000))
  );
  await assertFails(
    setDoc(doc(aliceDb, "freeNow", "alice"), expiresIn(3 * 60 * 60 * 1000))
  );

  // Nor store one that is already expired.
  await assertFails(
    setDoc(doc(aliceDb, "freeNow", "alice"), expiresIn(-1000))
  );

  // The five minutes above two hours absorb device clock skew.
  await assertSucceeds(
    setDoc(doc(aliceDb, "freeNow", "alice"), expiresIn(TWO_HOURS_MS + 60 * 1000))
  );
});

test("the status holds nothing but an expiry", async () => {
  const env = await setup();
  const aliceDb = env.authenticatedContext("alice").firestore();

  await assertFails(
    setDoc(doc(aliceDb, "freeNow", "alice"), {
      ...expiresIn(TWO_HOURS_MS),
      note: "at the library",
    })
  );
  await assertFails(
    setDoc(doc(aliceDb, "freeNow", "alice"), { expiresAt: "soon" })
  );
  await assertFails(setDoc(doc(aliceDb, "freeNow", "alice"), {}));
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});
