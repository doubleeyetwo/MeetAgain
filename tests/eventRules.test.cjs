
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
  updateDoc,
  Timestamp,
  serverTimestamp,
} = require("firebase/firestore");

const projectId = "demo-meetagain-rules-test";

test("creator can assign an item while preserving an unchanged legacy task", async () => {
  const env = await setup();
  const item = { id: 1, name: "Snacks", price: 5, completed: false, assigneeId: null };
  const eventId = "creator-assigns-item";
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "events", eventId), {
      ...eventData("alice", ["alice", "bob", "cara"], "assignment-group"),
      startAt: Timestamp.fromMillis(Date.now() + 60 * 60 * 1000),
      endAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000),
      items: [item],
      tasks: [{ id: 2, name: "Bring cups", completed: false, assigneeId: null, legacy: true }],
    });
  });
  const alice = doc(env.authenticatedContext("alice").firestore(), "events", eventId);
  const bob = doc(env.authenticatedContext("bob").firestore(), "events", eventId);
  const assign = (assigneeId) => ({
    items: [{ ...item, assigneeId }],
    updatedAt: serverTimestamp(),
  });
  await assertFails(updateDoc(bob, assign("cara")));
  await assertFails(updateDoc(alice, assign("outsider")));
  await assertSucceeds(updateDoc(alice, assign("bob")));
  assert.equal((await getDoc(alice)).data().items[0].assigneeId, "bob");
});

let testEnv;

test("upcoming event details respect participant and creator permissions", async () => {
  const env = await setup();
  const eventId = "edit-upcoming-details";
  const now = Date.now();
  const at = (hours) => Timestamp.fromMillis(now + hours * 60 * 60 * 1000);
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "events", eventId), {
      ...eventData("alice", ["alice", "bob"], "details-group"),
      startAt: at(1),
      endAt: at(2),
    });
  });

  const eventRef = (uid) => doc(env.authenticatedContext(uid).firestore(), "events", eventId);
  const save = (uid, changes) => updateDoc(eventRef(uid), { ...changes, updatedAt: serverTimestamp() });

  await assertSucceeds(save("bob", { title: "Updated title", category: "Other" }));
  await assertSucceeds(save("bob", { description: "Meet at the entrance." }));
  await assertSucceeds(save("bob", { photoURL: "data:image/jpeg;base64,AAAA" }));
  await assertFails(save("bob", { location: "New venue" }));
  await assertFails(save("bob", { startAt: at(3), endAt: at(4) }));
  await assertFails(save("outsider", { title: "Unauthorized" }));
  await assertSucceeds(save("alice", { location: "New venue" }));
  await assertSucceeds(save("alice", { startAt: at(3), endAt: at(4) }));
  await assertFails(save("alice", { startAt: at(5) }));
});

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
