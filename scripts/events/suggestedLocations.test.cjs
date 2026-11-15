const test = require('node:test');
const assert = require('node:assert/strict');

const {
  findByProp,
  findPressableShowing,
  flushEffects,
  loadModule,
  loadScreen,
  render,
  resetHooks,
  visibleText,
  walk,
} = require('./screenHarness.cjs');

// Issue #52: the Choose Location step asks for the device position, searches
// nearby places for the event category, and falls back to a default area when
// the planner refuses location access.

const CAMPUS = { latitude: 33.7838, longitude: -118.1141 };
const DEVICE = { latitude: 34.0522, longitude: -118.2437 };

const NEARBY = [
  {
    id: 'yard-house',
    name: 'Yard House',
    address: '401 Shoreline Village Dr, Long Beach',
    typeLabel: 'American Restaurant',
    icon: 'restaurant-outline',
    coords: { latitude: 33.7542, longitude: -118.1157 },
    rating: 4.4,
    priceLabel: '$$',
  },
  {
    id: 'shoreline-village',
    name: 'Shoreline Village',
    address: '429 Shoreline Village Drive, Long Beach',
    typeLabel: null,
    icon: 'location-outline',
    coords: null,
    rating: null,
    priceLabel: null,
  },
];

const baseParams = {
  eventName: 'Dinner Plans',
  category: 'Food & Dining',
};

// The screen's own fallback constant is built inside the vm realm, so compare
// the coordinates field by field rather than by object identity.
function assertSearchedOnce(searches, coords, category, presetId) {
  assert.equal(searches.length, 1);
  assert.equal(searches[0].category, category);
  assert.equal(searches[0].presetId, presetId);
  assert.equal(searches[0].coords.latitude, coords.latitude);
  assert.equal(searches[0].coords.longitude, coords.longitude);
}

// Builds the screen with a scripted permission answer and search result, and
// records what the screen asked the places service for.
function mountScreen({
  location,
  places = NEARBY,
  searchFails = false,
  params = baseParams,
}) {
  const searches = [];

  const { PickLocationScreen } = loadScreen(
    'src/features/events/screens/PickLocationScreen.tsx',
    {
      '@/features/events/distance': loadModule(
        'src/features/events/distance.ts'
      ),
      '@/features/events/deviceLocation': {
        getDeviceLocation: async () => location,
      },
      '@/features/events/placesService': {
        fetchNearbyPlaces: async (coords, category, presetId) => {
          searches.push({ coords, category, presetId });
          if (searchFails) throw new Error('Places search failed (403).');
          return places;
        },
      },
    }
  );

  resetHooks();
  const navigated = [];
  const props = {
    navigation: {
      navigate: (screen, params) => navigated.push({ screen, params }),
      goBack: () => {},
    },
    route: { params },
  };

  return { PickLocationScreen, props, searches, navigated };
}

test('the first frame tells the planner the search is running', () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(
    lines.some((line) => line.includes('Finding places nearby')),
    'the loading state should be visible before results arrive'
  );
});

test('granted permission searches the device position and lists the places', async () => {
  const { PickLocationScreen, props, searches } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assertSearchedOnce(searches, DEVICE, 'Food & Dining');
  assert.ok(lines.includes('Yard House'));
  assert.ok(lines.includes('401 Shoreline Village Dr, Long Beach'));
  assert.ok(lines.includes('4.4'), 'the review rating should be shown');
  assert.ok(
    lines.some((line) => line.includes('$$')),
    'the price level should be shown'
  );
  assert.ok(
    !lines.some((line) => line.includes('Finding places nearby')),
    'the loading state should be gone once results arrive'
  );
});

test('a place with no rating or price still renders its name and address', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(lines.includes('Shoreline Village'));
  assert.ok(lines.includes('429 Shoreline Village Drive, Long Beach'));
});

test('denied permission searches the fallback area and says why', async () => {
  const { PickLocationScreen, props, searches } = mountScreen({
    location: { status: 'denied' },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assertSearchedOnce(searches, CAMPUS, 'Food & Dining');
  assert.ok(
    lines.some((line) => line.includes('location access is off')),
    'the planner should be told why these places were chosen'
  );
  assert.ok(lines.includes('Yard House'), 'suggestions still load');
});

test('location services switched off falls back the same way', async () => {
  const { PickLocationScreen, props, searches } = mountScreen({
    location: { status: 'unavailable' },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  render(PickLocationScreen, props);

  assertSearchedOnce(searches, CAMPUS, 'Food & Dining');
});

test('granted permission does not show the fallback note', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(
    !lines.some((line) => line.includes('location access is off')),
    'the fallback note belongs only to the fallback path'
  );
});

test('tapping a suggestion carries its address to the next step', async () => {
  const { PickLocationScreen, props, navigated } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();

  const card = findPressableShowing(
    render(PickLocationScreen, props),
    'Yard House'
  );
  assert.ok(card, 'the suggestion should be pressable');
  card.props.onPress();

  const confirm = findByProp(
    render(PickLocationScreen, props),
    'title',
    'Confirm Location'
  );
  confirm.props.onPress();

  assert.equal(navigated.length, 1);
  assert.equal(
    navigated[0].params.location,
    '401 Shoreline Village Dr, Long Beach'
  );
});

test('the template reaches the places service, not just its category', async () => {
  // A Beach Day and a Campfire are both Outdoors, so the category alone cannot
  // tell the service what to look for.
  const { PickLocationScreen, props, searches } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
    params: {
      eventName: 'Beach Day',
      category: 'Outdoors',
      presetId: 'beach-day',
    },
  });

  render(PickLocationScreen, props);
  await flushEffects();

  assertSearchedOnce(searches, DEVICE, 'Outdoors', 'beach-day');
});

test('a card says what kind of place it is', async () => {
  // "Colorado Lagoon" could be a lake, a bar or a diner. The type line is what
  // tells the planner which.
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
    places: [
      {
        id: 'colorado-lagoon',
        name: 'Colorado Lagoon',
        address: '5119 E Colorado St, Long Beach',
        typeLabel: 'Park',
        icon: 'leaf-outline',
        rating: 4.3,
        priceLabel: null,
      },
    ],
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(
    lines.includes('Park'),
    'the place type should be readable on the card'
  );
});

test('the type and the price share one line', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(
    lines.some(
      (line) =>
        line.includes('American Restaurant') && line.includes('$$')
    ),
    'the card is only tall enough for one metadata line'
  );
});

test('a place with no type shows no empty metadata line', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
    places: [NEARBY[1]],
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(lines.includes('Shoreline Village'));
  assert.ok(
    !lines.includes(''),
    'an unlabelled place should not render a blank line'
  );
});

test('each card carries the icon the service chose', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();

  const card = findPressableShowing(
    render(PickLocationScreen, props),
    'Yard House'
  );
  const icons = [];
  walk(card, (node) => {
    if (node.props.name) icons.push(node.props.name);
  });

  assert.ok(
    icons.includes('restaurant-outline'),
    'the card should show the type icon the service picked'
  );
});

test('a card says roughly how far away the place is', async () => {
  // DEVICE is downtown LA and Yard House sits by Alamitos Bay, which is a bit
  // under 22 miles in a straight line.
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(
    lines.includes('~22 mi'),
    `expected an approximate distance, saw ${JSON.stringify(lines)}`
  );
});

test('the fallback area shows no distance at all', async () => {
  // The search ran from campus, not from the planner, so any distance on the
  // card would be measured from somewhere the planner is not.
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'denied' },
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(lines.includes('Yard House'), 'suggestions still load');
  assert.ok(
    !lines.some((line) => line.includes('mi')),
    `no distance belongs on the fallback, saw ${JSON.stringify(lines)}`
  );
});

test('a place with no coordinates shows no distance', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
    places: [NEARBY[1]],
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(lines.includes('Shoreline Village'));
  assert.ok(!lines.some((line) => line.includes('mi')));
});

test('a failed search asks the planner to type an address instead', async () => {
  const { PickLocationScreen, props } = mountScreen({
    location: { status: 'granted', coords: DEVICE },
    searchFails: true,
  });

  render(PickLocationScreen, props);
  await flushEffects();
  const lines = visibleText(render(PickLocationScreen, props));

  assert.ok(
    lines.some((line) => line.includes('Could not load suggestions')),
    'a failed search should not leave the planner stuck on a spinner'
  );
});
