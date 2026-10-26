
const fs = require("node:fs");
const assert = require("node:assert/strict");
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
  Timestamp,
  serverTimestamp,
} = require("firebase/firestore");

const projectId = "demo-meetagain-rules-test";

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

function eventData(creatorId, participantIds, groupId = null) {
  return {
    creatorId,
    title: "Test Event",
    startAt: Timestamp.fromDate(new Date("2026-11-10T18:00:00Z")),
    endAt: Timestamp.fromDate(new Date("2026-11-10T20:00:00Z")),
    participantIds,
    groupId,
    status: "confirmed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

test("creator can create a solo event", async () => {
  const env = await setup();
  const db = env.authenticatedContext("alice").firestore();

  await assertSucceeds(
    setDoc(doc(db, "events", "solo-test"), eventData("alice", ["alice"]))
  );
});

test("another user cannot read a solo event", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "events", "private-test"),
      eventData("alice", ["alice"])
    );
  });

  const bobDb = env.authenticatedContext("bob").firestore();

  await assertFails(getDoc(doc(bobDb, "events", "private-test")));
});

test("solo event cannot include unrelated participants", async () => {
  const env = await setup();
  const db = env.authenticatedContext("alice").firestore();

  await assertFails(
    setDoc(
      doc(db, "events", "invalid-solo-test"),
      eventData("alice", ["alice", "bob"])
    )
  );
});



test("group member can create an event", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "groups", "group-test"), {
      memberIds: ["alice", "bob"],
    });
  });

  const aliceDb = env.authenticatedContext("alice").firestore();

  await assertSucceeds(
    setDoc(
      doc(aliceDb, "events", "group-event-test"),
      eventData("alice", ["alice", "bob"], "group-test")
    )
  );
});

test("group participant can read the event", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "groups", "group-read-test"), {
      memberIds: ["alice", "bob"],
    });

    await setDoc(
      doc(context.firestore(), "events", "group-read-event"),
      eventData("alice", ["alice", "bob"], "group-read-test")
    );
  });

  const bobDb = env.authenticatedContext("bob").firestore();

  await assertSucceeds(
    getDoc(doc(bobDb, "events", "group-read-event"))
  );
});

test("outsider cannot read a group event", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(
      doc(context.firestore(), "events", "private-group-event"),
      eventData("alice", ["alice", "bob"], "group-test")
    );
  });

  const charlieDb = env.authenticatedContext("charlie").firestore();

  await assertFails(
    getDoc(doc(charlieDb, "events", "private-group-event"))
  );
});

test("group event cannot contain incorrect members", async () => {
  const env = await setup();

  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "groups", "group-invalid-test"), {
      memberIds: ["alice", "bob"],
    });
  });

  const aliceDb = env.authenticatedContext("alice").firestore();

  await assertFails(
    setDoc(
      doc(aliceDb, "events", "invalid-group-event"),
      eventData("alice", ["alice", "charlie"], "group-invalid-test")
    )
  );
});
after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});