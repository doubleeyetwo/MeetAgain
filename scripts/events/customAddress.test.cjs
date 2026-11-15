const test = require('node:test');
const assert = require('node:assert/strict');

const {
  TextInput,
  findByProp,
  findByType,
  findPressableShowing,
  flushEffects,
  host,
  loadScreen,
  render,
  resetHooks,
  visibleText,
} = require('./screenHarness.cjs');

// Issue #54: the address a planner types on Choose Location is followed into
// the params Review Event receives and the text it renders.

const SUGGESTION = {
  id: 'pedros-diner',
  name: "Pedro's Diner",
  address: '12345 Main St. Long Beach',
  rating: 4.6,
  priceLabel: '$$',
};

const { PickLocationScreen } = loadScreen(
  'src/features/events/screens/PickLocationScreen.tsx',
  {
    '@/features/events/deviceLocation': {
      getDeviceLocation: async () => ({
        status: 'granted',
        coords: { latitude: 33.7701, longitude: -118.1937 },
      }),
    },
    '@/features/events/placesService': {
      fetchNearbyPlaces: async () => [SUGGESTION],
    },
  }
);

const { ReviewEventScreen } = loadScreen(
  'src/features/events/screens/ReviewEventScreen.tsx',
  {
    '@/features/auth/AuthContext': {
      useAuth: () => ({ user: { uid: 'planner' } }),
    },
    '@/features/auth/profilePhoto': {
      pickPhotoFromLibrary: async () => null,
      takeProfilePhoto: async () => null,
    },
    '@/features/events/eventTimes': {
      formatEventDate: () => 'Fri, Nov 14',
      formatEventTime: () => '6:00 PM',
    },
    '@/components/EditPhoto': { EditPhoto: host('EditPhoto') },
    '@/features/events/eventTemplates': {
      getTemplate: () => undefined,
      getItemsForPreset: () => [],
      getTasksForPreset: () => [],
    },
    '@/features/events/eventService': { createEvent: async () => 'event-1' },
    '@/features/messages/groups': { createGroup: async () => ({ id: 'g1' }) },
    '@/features/messages/directConversations': {
      getOrCreateDirectConversation: async () => 'c1',
    },
    '@/config/firebase': { db: {} },
    'firebase/firestore': {
      doc: () => ({}),
      getDoc: async () => ({ exists: () => false, data: () => ({}) }),
    },
  }
);

const baseParams = {
  eventName: 'Dinner Plans',
  category: 'Food & Dining',
};

function mount() {
  resetHooks();
  const navigated = [];
  const navigation = {
    navigate: (screen, params) => navigated.push({ screen, params }),
    goBack: () => {},
  };
  return {
    navigated,
    navigation,
    props: { navigation, route: { params: baseParams } },
  };
}

test('a typed address reaches Review Event and is displayed exactly as entered', () => {
  const { navigated, navigation, props } = mount();

  const typed = '  456 Ocean Blvd. Long Beach  ';
  const input = findByType(render(PickLocationScreen, props), TextInput);
  input.props.onChangeText(typed);

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 1);
  // Choose Location hands off to Pick a Time, which carries the params the
  // rest of the flow forwards to Review Event untouched.
  assert.equal(navigated[0].screen, 'PickTime');
  assert.equal(
    navigated[0].params.location,
    '456 Ocean Blvd. Long Beach'
  );
  assert.equal(navigated[0].params.eventName, 'Dinner Plans');

  resetHooks();
  const review = render(ReviewEventScreen, {
    navigation,
    route: { params: navigated[0].params },
  });

  assert.ok(
    visibleText(review).includes('456 Ocean Blvd. Long Beach'),
    'Review Event should show the address exactly as it was entered'
  );
});

test('selecting a suggested location carries its address through', async () => {
  const { navigated, props } = mount();

  render(PickLocationScreen, props);
  await flushEffects();

  const card = findPressableShowing(
    render(PickLocationScreen, props),
    "Pedro's Diner"
  );
  assert.ok(card, 'the suggested location should be pressable');
  card.props.onPress();

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 1);
  assert.equal(navigated[0].params.location, SUGGESTION.address);
});

test('an empty address is rejected and the location is not changed', () => {
  const { navigated, props } = mount();

  const input = findByType(render(PickLocationScreen, props), TextInput);
  input.props.onChangeText('   ');

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 0);
  assert.ok(
    visibleText(render(PickLocationScreen, props)).includes(
      'Enter an address.'
    ),
    'an inline error should be shown'
  );
});

test('Review Event keeps its placeholder when no location was chosen', () => {
  resetHooks();
  const review = render(ReviewEventScreen, {
    navigation: { navigate: () => {}, goBack: () => {} },
    route: { params: baseParams },
  });

  assert.ok(visibleText(review).includes('Location not selected'));
});
