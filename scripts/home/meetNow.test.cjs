const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findByProp,
  findByType,
  loadModule,
  loadScreen,
  render,
  resetHooks,
  visibleText,
} = require('../events/screenHarness.cjs');

// Issue #34: a MeetNow status is one expiry timestamp per account. Nothing on
// the server clears a forgotten toggle, so every reader re-applies the expiry
// and a friend drops off the Home list the moment their status runs out.

const NOW = new Date('2026-11-15T19:00:00Z');
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

function at(offsetMs) {
  return new Date(NOW.getTime() + offsetMs);
}

// The module builds its arrays inside its own vm realm, so rebuild them here
// before comparing. A vm-realm array is never reference-equal to this one.
function ids(people) {
  return Array.from(people, (person) => person.id);
}

// Stands in for a Firestore Timestamp, which the app only ever reads through
// toDate(). Recording writes lets a test see what the toggle stored.
function timestampFor(date) {
  return { toDate: () => date };
}

// Loads the real module with a recording Firestore stand-in.
function loadMeetNow() {
  const writes = [];
  const deletes = [];
  const listeners = [];

  const meetNow = loadModule('src/features/home/meetNow.ts', {
    modules: {
      'firebase/firestore': {
        doc: (_db, collection, id) => ({ collection, id }),
        setDoc: async (ref, data) => {
          writes.push({ ref, data });
        },
        deleteDoc: async (ref) => {
          deletes.push(ref);
        },
        onSnapshot: (ref, onNext, onError) => {
          listeners.push({ ref, onNext, onError });
          return () => {
            listeners.splice(
              listeners.findIndex((entry) => entry.ref === ref),
              1,
            );
          };
        },
        Timestamp: { fromDate: timestampFor },
      },
      '@/config/firebase': { db: {} },
      '@/data/firestorePaths': { collections: { freeNow: 'freeNow' } },
    },
  });

  return { meetNow, writes, deletes, listeners };
}

test('a MeetNow status expires two hours after it is set', () => {
  const { meetNow } = loadMeetNow();

  assert.equal(meetNow.MEET_NOW_DURATION_MS, TWO_HOURS_MS);
  assert.equal(
    meetNow.meetNowExpiry(NOW).toISOString(),
    at(TWO_HOURS_MS).toISOString(),
  );
});

test('a status counts only while its expiry is still ahead', () => {
  const { meetNow } = loadMeetNow();

  assert.equal(meetNow.isMeetNowActive(at(TWO_HOURS_MS), NOW), true);
  assert.equal(meetNow.isMeetNowActive(at(1000), NOW), true);

  // The instant it expires it is already over, not still counting.
  assert.equal(meetNow.isMeetNowActive(NOW, NOW), false);
  assert.equal(meetNow.isMeetNowActive(at(-1000), NOW), false);
  assert.equal(meetNow.isMeetNowActive(at(-TWO_HOURS_MS), NOW), false);

  // No stored status at all, and a status that cannot be read as a time.
  assert.equal(meetNow.isMeetNowActive(null, NOW), false);
  assert.equal(meetNow.isMeetNowActive(undefined, NOW), false);
  assert.equal(meetNow.isMeetNowActive(new Date('nonsense'), NOW), false);
});

test('a malformed status document reads as off rather than throwing', () => {
  const { meetNow } = loadMeetNow();

  assert.equal(
    meetNow.readMeetNowExpiry({ expiresAt: timestampFor(at(TWO_HOURS_MS)) })
      ?.toISOString(),
    at(TWO_HOURS_MS).toISOString(),
  );
  assert.equal(
    meetNow.readMeetNowExpiry({ expiresAt: at(1000) })?.toISOString(),
    at(1000).toISOString(),
  );

  assert.equal(meetNow.readMeetNowExpiry({}), null);
  assert.equal(meetNow.readMeetNowExpiry(null), null);
  assert.equal(meetNow.readMeetNowExpiry('free'), null);
  assert.equal(meetNow.readMeetNowExpiry({ expiresAt: 'soon' }), null);
  assert.equal(meetNow.readMeetNowExpiry({ expiresAt: new Date('nonsense') }), null);
  assert.equal(
    meetNow.readMeetNowExpiry({ expiresAt: { toDate: () => 'not a date' } }),
    null,
  );
});

test('an expired friend is dropped from the available list', () => {
  const { meetNow } = loadMeetNow();

  const rows = [
    { id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(90 * 60 * 1000) },
    { id: 'lela', name: 'Lela W', photoURL: null, expiresAt: at(-60 * 1000) },
    { id: 'spencer', name: 'Spencer Wiitanen', photoURL: null, expiresAt: at(TWO_HOURS_MS) },
    { id: 'andrew', name: 'Andrew', photoURL: null, expiresAt: null },
  ];

  const active = meetNow.activeMeetNowFriends(rows, NOW);

  // Lela's status ran out a minute ago and Andrew never set one.
  assert.deepEqual(ids(active), ['spencer', 'blake']);

  // The same rows an hour and a half later: only the newest status survives.
  const later = meetNow.activeMeetNowFriends(rows, at(100 * 60 * 1000));
  assert.deepEqual(ids(later), ['spencer']);

  // And once both windows have closed, nobody is free.
  assert.deepEqual(meetNow.activeMeetNowFriends(rows, at(TWO_HOURS_MS)), []);
});

test('toggling on stores an expiry and toggling off deletes the status', async () => {
  const { meetNow, writes, deletes } = loadMeetNow();

  await meetNow.setMeetNow('ryan', true, NOW);

  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0].ref, { collection: 'freeNow', id: 'ryan' });
  assert.deepEqual(Object.keys(writes[0].data), ['expiresAt']);
  assert.equal(
    writes[0].data.expiresAt.toDate().toISOString(),
    at(TWO_HOURS_MS).toISOString(),
  );

  // Toggling off removes the document outright, so a friend's listener sees it
  // disappear instead of keeping a backdated status around.
  await meetNow.setMeetNow('ryan', false, NOW);

  assert.equal(writes.length, 1);
  assert.deepEqual(deletes, [{ collection: 'freeNow', id: 'ryan' }]);
});

test('watching a friend reports the stored expiry, and nothing once it is cleared', () => {
  const { meetNow, listeners } = loadMeetNow();
  const seen = [];

  const stop = meetNow.watchMeetNow('blake', (expiresAt) => seen.push(expiresAt), () => {});
  assert.equal(listeners.length, 1);

  listeners[0].onNext({
    exists: () => true,
    data: () => ({ expiresAt: timestampFor(at(TWO_HOURS_MS)) }),
  });
  listeners[0].onNext({ exists: () => false, data: () => undefined });

  assert.equal(seen.length, 2);
  assert.equal(seen[0].toISOString(), at(TWO_HOURS_MS).toISOString());
  assert.equal(seen[1], null);

  stop();
  assert.equal(listeners.length, 0);
});

// Loads the real bar so the test reads what a signed-in user actually sees.
function loadBar() {
  return loadScreen('src/features/home/components/MeetNowBar.tsx').MeetNowBar;
}

test('the Home bar lists the friends that are still free', () => {
  const { meetNow } = loadMeetNow();
  const MeetNowBar = loadBar();

  const friends = meetNow.activeMeetNowFriends(
    [
      { id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(60 * 60 * 1000) },
      { id: 'lela', name: 'Lela W', photoURL: null, expiresAt: at(-1000) },
    ],
    NOW,
  );

  resetHooks();
  const tree = render(MeetNowBar, { friends, available: true });
  const shown = visibleText(tree);

  assert.ok(shown.includes('MeetNow'));
  assert.ok(shown.includes('Blake Garcia'));
  // Lela's status expired, so she is not on the list.
  assert.ok(!shown.includes('Lela W'));
  assert.ok(!shown.includes('No friends are free right now.'));
});

test('the bar says nobody is free once every status has expired', () => {
  const { meetNow } = loadMeetNow();
  const MeetNowBar = loadBar();

  const friends = meetNow.activeMeetNowFriends(
    [{ id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(-1000) }],
    NOW,
  );

  resetHooks();
  const shown = visibleText(render(MeetNowBar, { friends, available: false }));

  assert.ok(shown.includes('No friends are free right now.'));
  assert.ok(!shown.includes('Blake Garcia'));
});

test('the bar switch reflects and reports the signed-in status', () => {
  const MeetNowBar = loadBar();
  const toggled = [];

  resetHooks();
  const off = render(MeetNowBar, {
    friends: [],
    available: false,
    onToggle: (next) => toggled.push(next),
  });
  const offSwitch = findByProp(off, 'accessibilityLabel', 'Free Now Visibility');
  assert.equal(offSwitch.props.value, false);

  offSwitch.props.onValueChange(true);

  resetHooks();
  const on = render(MeetNowBar, {
    friends: [],
    available: true,
    onToggle: (next) => toggled.push(next),
  });
  const onSwitch = findByProp(on, 'accessibilityLabel', 'Free Now Visibility');
  assert.equal(onSwitch.props.value, true);

  // Turning it off is what removes this account from friends' lists.
  onSwitch.props.onValueChange(false);

  assert.deepEqual(toggled, [true, false]);
});

test('a failed toggle tells the user instead of failing silently', () => {
  const MeetNowBar = loadBar();

  resetHooks();
  const shown = visibleText(
    render(MeetNowBar, {
      friends: [],
      available: false,
      statusError: 'Could not share that you are free. Try again.',
    }),
  );

  assert.ok(shown.includes('Could not share that you are free. Try again.'));
});

test('the user leads their own list while their switch is on', () => {
  const { meetNow } = loadMeetNow();

  const friends = [
    { id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(60 * 60 * 1000) },
  ];

  // Switch off: the list is friends only.
  assert.deepEqual(ids(meetNow.meetNowList(friends, null)), ['blake']);

  // Switch on: the user's own tile appears first, so flipping the switch is
  // something the user can see happen to themselves.
  const withSelf = meetNow.meetNowList(friends, {
    id: 'ryan',
    photoURL: 'https://example.com/ryan.jpg',
    displayName: 'Ryan Carrasco',
    available: true,
  });

  assert.deepEqual(ids(withSelf), ['ryan', 'blake']);
  assert.equal(withSelf[0].name, 'You');
  assert.equal(withSelf[0].isSelf, true);
  // The tile reads "You" but keeps the user's own initial behind it.
  assert.equal(withSelf[0].avatarName, 'Ryan Carrasco');
  assert.equal(withSelf[0].photoURL, 'https://example.com/ryan.jpg');
  assert.equal(withSelf[1].isSelf, undefined);
});

test('a user with no picture falls back to their own initial, not a Y', () => {
  const { meetNow } = loadMeetNow();

  // The avatar's initial is drawn inside a child component, which this harness
  // does not render, so check the name that initial is taken from.
  const named = meetNow.meetNowList([], {
    id: 'ryan',
    photoURL: null,
    displayName: 'Ryan Carrasco',
    available: true,
  });
  assert.equal(named[0].name, 'You');
  assert.equal(named[0].avatarName, 'Ryan Carrasco');

  // An account whose profile has not loaded yet still reads sensibly.
  const unnamed = meetNow.meetNowList([], {
    id: 'ryan',
    photoURL: null,
    available: true,
  });
  assert.equal(unnamed[0].avatarName, 'You');
});

test('the user is never listed twice as their own friend', () => {
  const { meetNow } = loadMeetNow();

  const list = meetNow.meetNowList(
    [
      { id: 'ryan', name: 'Ryan Carrasco', photoURL: null, expiresAt: at(1000) },
      { id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(1000) },
    ],
    { id: 'ryan', photoURL: null, available: true }
  );

  assert.deepEqual(ids(list), ['ryan', 'blake']);
  assert.equal(list[0].name, 'You');
});

test('the bar shows the user their own tile, and says when they are alone', () => {
  const { meetNow } = loadMeetNow();
  const MeetNowBar = loadBar();

  const alone = meetNow.meetNowList([], {
    id: 'ryan',
    photoURL: null,
    available: true,
  });

  resetHooks();
  const shown = visibleText(render(MeetNowBar, { friends: alone, available: true }));

  assert.ok(shown.includes('You'));
  assert.ok(shown.includes('Only you so far. Friends who are free will show up here.'));
  // The empty state would contradict the tile the user can see.
  assert.ok(!shown.includes('No friends are free right now.'));

  // With a friend along, the hint goes away.
  const together = meetNow.meetNowList(
    [{ id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(1000) }],
    { id: 'ryan', photoURL: null, available: true }
  );

  resetHooks();
  const both = visibleText(render(MeetNowBar, { friends: together, available: true }));

  assert.ok(both.includes('You'));
  assert.ok(both.includes('Blake Garcia'));
  assert.ok(!both.includes('Only you so far. Friends who are free will show up here.'));
});

test('switching off keeps the tile but marks it as not sharing', () => {
  const { meetNow } = loadMeetNow();
  const MeetNowBar = loadBar();

  // The tile stays put either way. Only the badge and the prompt change, which
  // is easier to notice than a tile that disappears.
  const off = meetNow.meetNowList([], {
    id: 'ryan',
    photoURL: null,
    displayName: 'Ryan Carrasco',
    available: false,
  });

  assert.equal(off.length, 1);
  assert.equal(off[0].isSelf, true);
  assert.equal(off[0].available, false);

  resetHooks();
  const shown = visibleText(render(MeetNowBar, { friends: off, available: false }));

  assert.ok(shown.includes('You'));
  assert.ok(shown.includes('Turn on MeetNow to tell friends you are free.'));
  assert.ok(!shown.includes('Only you so far. Friends who are free will show up here.'));
  // The tile is on screen, so the empty state would contradict it.
  assert.ok(!shown.includes('No friends are free right now.'));
});

test('a friend on the list is never drawn as away', () => {
  const { meetNow } = loadMeetNow();

  // Friends reach the list only while free, so only the user's own tile can
  // carry a false availability.
  const list = meetNow.meetNowList(
    [{ id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(1000) }],
    { id: 'ryan', photoURL: null, available: false }
  );

  assert.equal(list[0].available, false);
  assert.equal(list[1].available, undefined);
});

test('Home renders the real availability list, not a placeholder', () => {
  const { meetNow } = loadMeetNow();
  const MeetNowBar = loadBar();

  const friends = meetNow.activeMeetNowFriends(
    [
      { id: 'blake', name: 'Blake Garcia', photoURL: null, expiresAt: at(60 * 60 * 1000) },
      { id: 'spencer', name: 'Spencer Wiitanen', photoURL: null, expiresAt: at(-1000) },
    ],
    NOW,
  );

  const { HomeScreen } = loadScreen('src/features/home/screens/HomeScreen.tsx', {
    '../meetNow': meetNow,
    '../components/MeetNowBar': { MeetNowBar },
    '../components/UpcomingEventCard': { UpcomingEventCard: () => null },
    '../useMeetNow': {
      useMeetNowFriends: () => ({ friends, loading: false, error: false }),
      useMeetNowStatus: () => ({
        available: true,
        expiresAt: at(TWO_HOURS_MS),
        loading: false,
        saving: false,
        error: '',
        toggle: () => {},
      }),
    },
    '@/features/auth/AuthContext': { useAuth: () => ({ user: { uid: 'ryan' } }) },
    '@/config/firebase': { db: {} },
    'firebase/firestore': {
      collection: () => ({}),
      query: () => ({}),
      where: () => ({}),
      onSnapshot: () => () => {},
    },
  });

  resetHooks();
  const bar = findByType(render(HomeScreen, {}), MeetNowBar);
  assert.ok(bar, 'Home should render the MeetNow bar');

  // Home hands the bar the live list: the signed-in user first because their
  // switch is on, then the friend who is still free. The expired one never
  // reaches it.
  assert.deepEqual(ids(bar.props.friends), ['ryan', 'blake']);
  assert.equal(bar.props.friends[0].available, true);
  assert.equal(bar.props.available, true);
  assert.equal(bar.props.loading, false);
  assert.equal(bar.props.toggleDisabled, false);

  // The harness does not render child components, so render the bar with the
  // props Home gave it to read what ends up on screen.
  resetHooks();
  const shown = visibleText(render(MeetNowBar, bar.props));

  assert.ok(shown.includes('You'));
  assert.ok(shown.includes('Blake Garcia'));
  assert.ok(!shown.includes('Spencer Wiitanen'));
  // The four hardcoded names the bar used to ship with are gone for good.
  assert.ok(!shown.includes('Ryan Carrasco'));
});
