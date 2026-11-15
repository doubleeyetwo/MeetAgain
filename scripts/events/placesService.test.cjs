const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./screenHarness.cjs');

// Issue #52: a suggestion has to match the activity the planner picked, and a
// planner has to be able to tell what a place is from its card.

// Stands in for the device's storage. `shared` lets a test hand the same
// storage to a second load of the service, which is what a relaunch looks
// like from the cache's point of view.
// TypeScript's __importDefault helper wraps a module that is not an ES module,
// so this is handed over bare and comes out as the default import.
function memoryStorage(shared = { data: {} }, broken = false) {
  return {
    store: shared,
    async getItem(key) {
      if (broken) throw new Error('storage unavailable');
      return shared.data[key] ?? null;
    },
    async setItem(key, value) {
      if (broken) throw new Error('storage unavailable');
      shared.data[key] = value;
    },
    async removeItem(key) {
      delete shared.data[key];
    },
  };
}

// Loads the service with a stubbed fetch, and records every request body so a
// test can check what was actually asked of Google.
function loadService(responses = [{ places: [] }], storage = memoryStorage()) {
  const requests = [];
  let call = 0;

  const service = loadModule('src/features/events/placesService.ts', {
    modules: {
      '@react-native-async-storage/async-storage': storage,
    },
    globals: {
      process: {
        env: { EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: 'test-key' },
      },
      fetch: async (url, options) => {
        requests.push({
          url,
          headers: options.headers,
          body: JSON.parse(options.body),
        });

        const payload =
          typeof responses === 'function'
            ? responses(JSON.parse(options.body))
            : responses[Math.min(call, responses.length - 1)];
        call += 1;

        if (payload instanceof Error) {
          return { ok: false, status: 403 };
        }

        return { ok: true, status: 200, json: async () => payload };
      },
    },
  });

  return { service, requests };
}

// The service builds its arrays inside the vm realm, where Array.prototype is
// a different object, so deepEqual on them fails on identity alone. Copying
// the names into this realm compares the values that actually matter.
function names(places) {
  return places.map((p) => p.name);
}

// Answers a varied search the way Google does: each type search comes back
// with places of that type only.
function byType(map) {
  return (body) => {
    const type = body.includedTypes[0];
    return { places: map[type] ?? [] };
  };
}

function place(overrides) {
  return {
    id: 'place-1',
    displayName: { text: 'Somewhere' },
    formattedAddress: '1 Main St, Long Beach, CA 90815, USA',
    primaryType: 'park',
    primaryTypeDisplayName: { text: 'Park' },
    location: { latitude: 33.7542, longitude: -118.1157 },
    rating: 4.5,
    userRatingCount: 40,
    ...overrides,
  };
}

const COORDS = { latitude: 33.7838, longitude: -118.1141 };

// The bug this feature shipped with: every Outdoors template issued the same
// park search and every Entertainment template the same theater search, so
// Beach Day returned parks and Movie Night returned stage theaters.
const TEMPLATE_EXPECTATIONS = [
  ['hiking', 'Outdoors', ['hiking_area', 'national_park', 'state_park'], 15000],
  ['campfire', 'Outdoors', ['campground'], 20000],
  ['beach-day', 'Outdoors', ['beach'], 8000],
  ['study-session', 'Study', ['library'], 5000],
  ['dinner', 'Food & Dining', ['restaurant'], 3000],
  ['movie-night', 'Entertainment', ['movie_theater'], 12000],
  [
    'game-night',
    'Entertainment',
    ['amusement_center', 'video_arcade', 'bowling_alley'],
    12000,
  ],
  ['shopping', 'Entertainment', ['shopping_mall', 'department_store'], 5000],
];

test('every template searches for its own activity, not its category', () => {
  const { service } = loadService();

  for (const [presetId, category, types, radius] of TEMPLATE_EXPECTATIONS) {
    const spec = service.searchSpecFor(category, presetId);

    assert.deepEqual(
      [...spec.includedTypes],
      types,
      `${presetId} should search ${types.join(', ')}`
    );
    assert.equal(
      spec.radiusMeters,
      radius,
      `${presetId} should search within ${radius}m`
    );
  }
});

test('templates sharing a category still search different things', () => {
  const { service } = loadService();

  const outdoors = ['hiking', 'campfire', 'beach-day'].map((id) =>
    service.searchSpecFor('Outdoors', id).includedTypes.join(',')
  );
  const entertainment = ['movie-night', 'game-night', 'shopping'].map((id) =>
    service.searchSpecFor('Entertainment', id).includedTypes.join(',')
  );

  assert.equal(new Set(outdoors).size, 3, 'Outdoors templates must differ');
  assert.equal(
    new Set(entertainment).size,
    3,
    'Entertainment templates must differ'
  );
});

test('Movie Night does not search stage theaters, galleries or museums', () => {
  const { service } = loadService();
  const types = service.searchSpecFor('Entertainment', 'movie-night')
    .includedTypes;

  for (const unwanted of [
    'performing_arts_theater',
    'art_gallery',
    'museum',
  ]) {
    assert.ok(
      !types.includes(unwanted),
      `a movie night should not search ${unwanted}`
    );
  }
});

test('a custom event with no template searches its category', () => {
  const { service } = loadService();

  assert.deepEqual(
    [...service.searchSpecFor('Study').includedTypes],
    ['library', 'cafe', 'book_store']
  );
});

test('an unrecognised category searches the general mix', () => {
  const { service } = loadService();

  const types = [...service.searchSpecFor('Knitting Circle').includedTypes];

  // Nothing is known about the event, so the mix spans different kinds of
  // outing: eat, green space, water, a show, shops, a landmark.
  for (const expected of [
    'restaurant',
    'park',
    'beach',
    'movie_theater',
    'shopping_mall',
    'tourist_attraction',
  ]) {
    assert.ok(types.includes(expected), `the mix should include ${expected}`);
  }

  // Each type is its own billed search and the project allows 100 a day, so
  // this list stays short on purpose.
  assert.equal(types.length, 6, 'the general mix is capped at six searches');
});

test('the request carries the template radius and excluded types', async () => {
  const { service, requests } = loadService();

  await service.fetchNearbyPlaces(COORDS, 'Food & Dining', 'dinner');

  const [request] = requests;
  assert.equal(request.body.locationRestriction.circle.radius, 3000);
  assert.ok(
    request.body.excludedTypes.includes('fast_food_restaurant'),
    'a dinner plan should exclude counter service'
  );
});

test('a search with no excluded types omits the field entirely', async () => {
  const { service, requests } = loadService();

  await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.ok(!('excludedTypes' in requests[0].body));
});

test('a template labels every result the same way', async () => {
  // Google returned these for a hiking search, so they are hiking places even
  // when its own label describes the organisation instead of the activity.
  // The Bolsa Chica Conservancy really is a trailhead into the reserve.
  const { service } = loadService([
    {
      places: [
        place({
          id: 'trailhead',
          displayName: { text: 'Bolsa Chica Wetlands West Trailhead' },
          primaryType: 'hiking_area',
          primaryTypeDisplayName: { text: 'Hiking Area' },
        }),
        place({
          id: 'conservancy',
          displayName: { text: 'Bolsa Chica Conservancy' },
          formattedAddress: '3842 Warner Ave, Huntington Beach, CA, USA',
          primaryType: 'non_profit_organization',
          primaryTypeDisplayName: { text: 'Non-Profit Organization' },
        }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'hiking');

  assert.deepEqual(
    [...found.map((p) => p.typeLabel)],
    ['Hiking Area', 'Hiking Area'],
    'a hiking list should read as hiking places throughout'
  );
  assert.deepEqual(
    [...found.map((p) => p.icon)],
    ['trail-sign-outline', 'trail-sign-outline']
  );
});

test('Dinner keeps the cuisine Google reports', async () => {
  // The uniform label is for templates where Google's own one misleads. Every
  // Dinner result is a restaurant either way, so the cuisine is pure gain.
  const { service, requests } = loadService([
    {
      places: [
        place({
          id: 'acapulco',
          displayName: { text: 'Acapulco' },
          primaryType: 'mexican_restaurant',
          primaryTypeDisplayName: { text: 'Mexican Restaurant' },
        }),
        place({
          id: 'green-field',
          displayName: { text: 'Green Field Churrascaria' },
          formattedAddress: '5305 Pacific Coast Hwy, Long Beach, CA, USA',
          primaryType: 'brazilian_restaurant',
          primaryTypeDisplayName: { text: 'Brazilian Restaurant' },
        }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Food & Dining', 'dinner');

  assert.deepEqual(
    [...found.map((p) => p.typeLabel)],
    ['Mexican Restaurant', 'Brazilian Restaurant']
  );
  assert.deepEqual(
    [...found.map((p) => p.icon)],
    ['restaurant-outline', 'restaurant-outline'],
    'the long tail of cuisines still maps to one icon'
  );

  // Dropping the uniform label must not turn Dinner into a per type fan out.
  assert.equal(requests.length, 1, 'a template is still a single search');
  assert.equal(requests[0].body.maxResultCount, 10);
});

test('a custom event lets each place describe itself', async () => {
  const { service } = loadService([
    {
      places: [
        place({
          id: 'lagoon',
          displayName: { text: 'Colorado Lagoon' },
          primaryType: 'park',
          primaryTypeDisplayName: { text: 'Park' },
        }),
        place({
          id: 'rosie',
          displayName: { text: "Rosie's Dog Beach" },
          formattedAddress: '5000 E Ocean Blvd, Long Beach, CA, USA',
          primaryType: 'dog_park',
          primaryTypeDisplayName: { text: 'Dog Park' },
        }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.deepEqual([...found.map((p) => p.typeLabel)], ['Park', 'Dog Park']);
  assert.deepEqual(
    [...found.map((p) => p.icon)],
    ['leaf-outline', 'paw-outline']
  );
});

test('a varied search asks for each type on its own', async () => {
  // A single mixed search near campus comes back as ten parks, because Google
  // ranks by popularity and parks outnumber everything else outdoors.
  const { service, requests } = loadService(byType({}));

  await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  const asked = requests.map((r) => r.body.includedTypes.join(','));
  assert.deepEqual(
    [...asked],
    ['park', 'beach', 'hiking_area', 'dog_park', 'botanical_garden'],
    'each type gets its own search so none can crowd out the others'
  );
});

test('a varied list leads with the best of each type', async () => {
  const { service } = loadService(
    byType({
      park: [
        place({ id: 'p1', displayName: { text: 'Hilltop Park' }, primaryType: 'park', rating: 4.8 }),
        place({ id: 'p2', displayName: { text: 'Bixby Park' }, primaryType: 'park', rating: 4.5 }),
      ],
      beach: [
        place({ id: 'b1', displayName: { text: "Mother's Beach" }, primaryType: 'beach', rating: 4.5 }),
      ],
      hiking_area: [
        place({ id: 'h1', displayName: { text: 'Signal Hill trail' }, primaryType: 'hiking_area', rating: 4.7 }),
      ],
    })
  );

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.deepEqual(
    [...names(found)],
    ['Hilltop Park', "Mother's Beach", 'Signal Hill trail', 'Bixby Park'],
    'the top of each type comes first, then the seconds'
  );
});

test('a template still costs a single search', async () => {
  const { service, requests } = loadService();

  await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.equal(requests.length, 1, 'one activity needs one search');
});

test('a type two categories share is searched once', async () => {
  // Both Outdoors and Sports & Fitness want parks.
  const { service, requests } = loadService(byType({}));

  await service.fetchNearbyPlaces(COORDS, 'Outdoors');
  const afterFirst = requests.length;
  await service.fetchNearbyPlaces(COORDS, 'Sports & Fitness');

  const parkSearches = requests.filter(
    (r) => r.body.includedTypes.join(',') === 'park'
  );
  assert.equal(parkSearches.length, 1, 'the second category reuses the answer');
  assert.ok(requests.length > afterFirst, 'its other types are still searched');
});

test('one failing type still leaves a usable list', async () => {
  const { service } = loadService((body) =>
    body.includedTypes[0] === 'park'
      ? new Error('boom')
      : { places: [place({ id: 'b1', displayName: { text: "Mother's Beach" } })] }
  );

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.ok(found.length > 0, 'the types that answered are still shown');
});

test('every type failing surfaces the error', async () => {
  const { service } = loadService(() => new Error('boom'));

  await assert.rejects(() => service.fetchNearbyPlaces(COORDS, 'Outdoors'));
});

test('a badly rated place is never suggested', async () => {
  const { service } = loadService([
    {
      places: [
        place({ id: 'good', displayName: { text: 'Hilltop Park' }, rating: 4.8 }),
        place({ id: 'meh', displayName: { text: 'The Gardens Casino' }, rating: 3.9 }),
        place({ id: 'bad', displayName: { text: 'Sad Park' }, rating: 2.1 }),
        place({ id: 'none', displayName: { text: 'Unrated Park' }, rating: undefined }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.deepEqual([...names(found)], ['Hilltop Park']);
});

test('a template keeps Google\'s own ordering', async () => {
  const { service } = loadService([
    {
      places: [
        place({ id: 'a', displayName: { text: 'Regal Edwards' }, primaryType: 'movie_theater' }),
        place({ id: 'b', displayName: { text: 'Harkins Cerritos' }, primaryType: 'movie_theater' }),
        place({ id: 'c', displayName: { text: 'AMC Marina Pacifica' }, primaryType: 'movie_theater' }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Entertainment', 'movie-night');

  assert.deepEqual(
    [...names(found)],
    ['Regal Edwards', 'Harkins Cerritos', 'AMC Marina Pacifica']
  );
});

test('each per type search asks for only a few of that type', async () => {
  const { service, requests } = loadService(byType({}));

  await service.fetchNearbyPlaces(COORDS, 'Outdoors');
  assert.equal(requests[0].body.maxResultCount, 5);

  const template = loadService();
  await template.service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');
  assert.equal(template.requests[0].body.maxResultCount, 10);
});

test('a place Google does not label still renders without a type', async () => {
  const { service } = loadService([
    {
      places: [
        place({ primaryType: undefined, primaryTypeDisplayName: undefined }),
      ],
    },
  ]);

  const [found] = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.equal(found.typeLabel, null);
  assert.equal(found.icon, 'location-outline');
});

test("Google's long tail of types still gets a sensible icon", () => {
  const { service } = loadService();

  assert.equal(service.iconForPlaceType('vegan_restaurant'), 'restaurant-outline');
  assert.equal(service.iconForPlaceType('asian_fusion_restaurant'), 'restaurant-outline');
  assert.equal(service.iconForPlaceType('sporting_goods_store'), 'bag-handle-outline');
  assert.equal(service.iconForPlaceType('art_museum'), 'color-palette-outline');
  assert.equal(service.iconForPlaceType('city_park'), 'leaf-outline');
  assert.equal(service.iconForPlaceType(undefined), 'location-outline');

  // Google uses bare types alongside the specific ones, and the suffix rules
  // below do not catch those.
  assert.equal(service.iconForPlaceType('restaurant'), 'restaurant-outline');
  assert.equal(service.iconForPlaceType('cafe'), 'cafe-outline');
  assert.equal(service.iconForPlaceType('museum'), 'business-outline');
  assert.equal(service.iconForPlaceType('casino'), 'dice-outline');
});

test('a place repeated in one response is listed once', async () => {
  // The live beach search really does return one id twice, which also collides
  // on the React list key.
  const { service } = loadService([
    {
      places: [
        place({ id: 'dup', displayName: { text: "Mother's Beach" } }),
        place({ id: 'dup', displayName: { text: "Mother's Beach" } }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.equal(found.length, 1);
});

test('two ids for the same spot are listed once', async () => {
  const { service } = loadService([
    {
      places: [
        place({ id: 'a', displayName: { text: 'Bayshore Beach' } }),
        place({ id: 'b', displayName: { text: 'Bayshore Beach' } }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.equal(found.length, 1);
});

test('branches of a chain keep their own cards', async () => {
  const { service } = loadService([
    {
      places: [
        place({
          id: 'target-a',
          displayName: { text: 'Target' },
          formattedAddress: '2270 N Bellflower Blvd, Long Beach, CA, USA',
        }),
        place({
          id: 'target-b',
          displayName: { text: 'Target' },
          formattedAddress: '5760 E 7th St, Long Beach, CA, USA',
        }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Entertainment', 'shopping');

  assert.equal(found.length, 2, 'different addresses are different stores');
});

test('a place almost nobody has rated is not suggested', async () => {
  // A Little Free Library is tagged 'library' but is a box on a lawn.
  const { service } = loadService([
    {
      places: [
        place({ id: 'real', displayName: { text: 'CSULB University Library' }, userRatingCount: 226 }),
        place({ id: 'box', displayName: { text: 'Little Free Library' }, userRatingCount: 2 }),
        place({ id: 'none', displayName: { text: 'Ihss' }, userRatingCount: undefined }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Study', 'study-session');

  assert.deepEqual([...names(found)], ['CSULB University Library']);
});

test('a place with no id or no name is dropped', async () => {
  const { service } = loadService([
    {
      places: [
        place({ id: undefined }),
        place({ id: 'nameless', displayName: undefined }),
        place({ id: 'fine', displayName: { text: 'Whaley Park' } }),
      ],
    },
  ]);

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.deepEqual([...names(found)], ['Whaley Park']);
});

test('a place carries its coordinates so the card can measure the distance', async () => {
  const { service, requests } = loadService([{ places: [place()] }]);

  const [found] = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.deepEqual(
    { ...found.coords },
    { latitude: 33.7542, longitude: -118.1157 }
  );
  assert.ok(
    requests[0].headers['X-Goog-FieldMask'].includes('places.location'),
    'the search has to ask for the coordinates'
  );
});

test('a place Google gives no coordinates for still renders', async () => {
  const { service } = loadService([
    { places: [place({ location: undefined })] },
  ]);

  const [found] = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.equal(found.coords, null, 'no coordinates means no distance shown');
  assert.equal(found.name, 'Somewhere');
});

test('the long address is shortened for the card', async () => {
  const { service } = loadService([{ places: [place()] }]);

  const [found] = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.equal(found.address, '1 Main St, Long Beach');
});

test('a price level becomes a label a planner can read', async () => {
  const { service } = loadService([
    { places: [place({ priceLevel: 'PRICE_LEVEL_MODERATE' })] },
  ]);

  const [found] = await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.equal(found.priceLabel, '$$');
});

test('two templates in the same place are billed as two searches', async () => {
  const { service, requests } = loadService([{ places: [place()] }]);

  await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'hiking');
  await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.equal(requests.length, 2, 'the cache must not mix up two templates');
});

test('the same search twice is billed once', async () => {
  const { service, requests } = loadService([{ places: [place()] }]);

  await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'hiking');
  await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'hiking');

  assert.equal(requests.length, 1);
});

test('two mounts in the same tick are billed once', async () => {
  const { service, requests } = loadService([{ places: [place()] }]);

  await Promise.all([
    service.fetchNearbyPlaces(COORDS, 'Outdoors', 'hiking'),
    service.fetchNearbyPlaces(COORDS, 'Outdoors', 'hiking'),
  ]);

  assert.equal(requests.length, 1);
});

test('a saved cache survives a relaunch', async () => {
  // The project is capped at 100 searches a day, so a team rehearsing the same
  // walkthrough must not pay for it twice.
  const shared = { data: {} };
  const first = loadService([{ places: [place()] }], memoryStorage(shared));

  await first.service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');
  assert.equal(first.requests.length, 1);

  // A second load with the same storage is the app starting again.
  const second = loadService([{ places: [place()] }], memoryStorage(shared));
  const found = await second.service.fetchNearbyPlaces(
    COORDS,
    'Outdoors',
    'beach-day'
  );

  assert.equal(second.requests.length, 0, 'the relaunch should bill nothing');
  assert.deepEqual([...names(found)], ['Somewhere']);
});

test('a stale saved cache is searched again', async () => {
  const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const shared = {
    data: {
      'meetagain.places.cache.v1': JSON.stringify({
        '33.784,-118.114|beach|8000|': {
          at: eightDaysAgo,
          places: [{ primaryType: 'beach', place: { id: 'old', name: 'Stale Beach' } }],
        },
      }),
    },
  };

  const { service, requests } = loadService(
    [{ places: [place({ displayName: { text: 'Fresh Beach' } })] }],
    memoryStorage(shared)
  );

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.equal(requests.length, 1, 'a week old answer is not reused');
  assert.deepEqual([...names(found)], ['Fresh Beach']);
});

test('storage that cannot be read still loads places', async () => {
  const { service } = loadService(
    [{ places: [place()] }],
    memoryStorage({ data: {} }, true)
  );

  const found = await service.fetchNearbyPlaces(COORDS, 'Outdoors', 'beach-day');

  assert.equal(found.length, 1, 'a broken cache costs a search, not the screen');
});

test('a missing API key fails loudly instead of showing an empty list', async () => {
  const service = loadModule('src/features/events/placesService.ts', {
    modules: {
      '@react-native-async-storage/async-storage': memoryStorage(),
    },
    globals: { process: { env: {} }, fetch: async () => ({ ok: true }) },
  });

  await assert.rejects(
    () => service.fetchNearbyPlaces(COORDS, 'Outdoors'),
    /EXPO_PUBLIC_GOOGLE_PLACES_API_KEY/
  );
});

test('the key is sent with the bundle id it is restricted to', async () => {
  const { service, requests } = loadService();

  await service.fetchNearbyPlaces(COORDS, 'Outdoors');

  assert.equal(requests[0].headers['X-Ios-Bundle-Identifier'], 'com.fivestack.meetagain');
  assert.ok(requests[0].headers['X-Goog-FieldMask'].includes('places.primaryTypeDisplayName'));
});
