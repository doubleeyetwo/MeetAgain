
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DeviceCoords } from '@/features/events/deviceLocation';

const ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';

// The key is restricted to this bundle, so the header has to match app.json.
const IOS_BUNDLE_ID = 'com.fivestack.meetagain';

// Only the fields a suggestion card renders. Every extra field can push the
// request into a higher billed SKU, so this list stays tight on purpose.
// primaryType, primaryTypeDisplayName and location are Pro tier fields and
// rating and priceLevel are Enterprise tier. Billing takes the highest tier
// any requested field belongs to, so the request already bills as Enterprise
// and those three add nothing to the cost.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.priceLevel',
  'places.userRatingCount',
].join(',');

const MAX_RESULTS = 10;

// A varied search asks for each type separately, so a handful of the best of
// each is all the merge below needs.
const PER_TYPE_RESULTS = 5;

// A suggestion is a recommendation, so a badly reviewed place does not belong
// in the list under any circumstances. Near campus this floor drops the 3.8
// and 3.9 spots and keeps everything from 4.0 up. The API cannot filter on
// rating, so it is applied to the response.
const MIN_RATING = 4;

// Google tags things that are not venues. A Study search returned two Little
// Free Libraries, the book exchange boxes, and a Campfire search returned
// three campgrounds that do not appear to exist. Real places near campus carry
// dozens of ratings and these carried 0 to 2, so a low floor separates them
// without dropping a genuinely small trailhead.
const MIN_RATING_COUNT = 5;

// What a nearby search looks for. The radius belongs here because the right
// distance depends on the activity: a restaurant across the street is useful,
// a hiking trail across the street does not exist in Long Beach.
export type PlaceSearchSpec = {
  includedTypes: string[];
  excludedTypes?: string[];
  radiusMeters: number;

  // Set on template searches only. A template names one activity, so it runs
  // as a single query in Google's own order instead of fanning out per type.
  template?: true;

  // Templates usually label every result the same way. A planner who picked Hiking
  // already knows what they asked for, and Google's own label describes the
  // kind of organization rather than what you can do there: the Bolsa Chica
  // Conservancy is a real trailhead into the reserve, but its primary type is
  // 'non_profit_organization', which makes it read like an office. Google
  // returned it for a hiking search, so the card says Hiking Area.
  //
  // Left unset when Google's own label beats anything a template could say:
  // every Dinner result is a restaurant, so 'Mexican Restaurant' and
  // 'Brazilian Restaurant' tell a planner more than 'Restaurant' ten times
  // over, and neither one is ever wrong.
  label?: string;
  icon?: string;
};

// Keyed on template id, because a category is too coarse to search on. All
// three Outdoors templates used to issue the same park search, which is why
// Beach Day returned Whaley Park, and all three Entertainment templates issued
// the same theater search, which is why Movie Night returned the Carpenter
// Performing Arts Center and a university theatre department.
//
// Every list below was checked against live results near campus. Google ranks
// by popularity and tags generously, so a broad type crowds out the specific
// one: adding 'park' to the hiking list buried every trail under El Dorado
// Park, and 'rv_park' under Campfire returned mobile home parks.
const TEMPLATE_SEARCHES: Record<string, PlaceSearchSpec> = {
  hiking: {
    includedTypes: ['hiking_area', 'national_park', 'state_park'],
    radiusMeters: 15000,
    template: true,
    label: 'Hiking Area',
    icon: 'trail-sign-outline',
  },

  // Long Beach has no campgrounds, so this one has to reach out to Bolsa Chica
  // and Los Alamitos to return anything at all.
  campfire: {
    includedTypes: ['campground'],
    radiusMeters: 20000,
    template: true,
    label: 'Campground',
    icon: 'bonfire-outline',
  },

  'beach-day': {
    includedTypes: ['beach'],
    radiusMeters: 8000,
    template: true,
    label: 'Beach',
    icon: 'umbrella-outline',
  },

  'study-session': {
    includedTypes: ['library'],
    radiusMeters: 5000,
    template: true,
    label: 'Library',
    icon: 'library-outline',
  },

  // Excluding the counter-service types is what keeps In-N-Out, Chick-fil-A
  // and Krispy Kreme out of a dinner plan.
  dinner: {
    includedTypes: ['restaurant'],
    excludedTypes: [
      'fast_food_restaurant',
      'donut_shop',
      'cafe',
      'coffee_shop',
    ],
    radiusMeters: 3000,
    template: true,
  },

  'movie-night': {
    includedTypes: ['movie_theater'],
    radiusMeters: 12000,
    template: true,
    label: 'Movie Theater',
    icon: 'film-outline',
  },

  'game-night': {
    includedTypes: ['amusement_center', 'video_arcade', 'bowling_alley'],
    radiusMeters: 12000,
    template: true,
    label: 'Arcade & Bowling',
    icon: 'game-controller-outline',
  },

  shopping: {
    includedTypes: ['shopping_mall', 'department_store'],
    radiusMeters: 5000,
    template: true,
    label: 'Shops & Malls',
    icon: 'bag-handle-outline',
  },
};

// A custom event has no template, so its category is the only thing to go on.
// These lists are deliberately wider than a template's: the planner has not
// told us the activity, so the list shows the range of what is around them and
// lets each place describe itself.
const CATEGORY_SEARCHES: Record<string, PlaceSearchSpec> = {
  'Food & Dining': {
    includedTypes: ['restaurant', 'cafe', 'bar', 'bakery', 'ice_cream_shop'],
    radiusMeters: 3000,
  },

  Outdoors: {
    includedTypes: [
      'park',
      'beach',
      'hiking_area',
      'dog_park',
      'botanical_garden',
    ],
    radiusMeters: 8000,
  },

  Entertainment: {
    includedTypes: [
      'movie_theater',
      'performing_arts_theater',
      'art_gallery',
      'museum',
      'bowling_alley',
      'amusement_center',
    ],
    radiusMeters: 12000,
  },

  Study: {
    includedTypes: ['library', 'cafe', 'book_store'],
    radiusMeters: 5000,
  },

  'Sports & Fitness': {
    includedTypes: [
      'gym',
      'fitness_center',
      'sports_complex',
      'swimming_pool',
      'park',
    ],
    radiusMeters: 8000,
  },
};

// A free text category from the Other field, or no category at all. Nothing is
// known about the event, so the list shows a spread of what is nearby.
// Six kinds of outing rather than ten: eat, green space, water, a show, shops
// and a landmark. Each type here is a separate billed search and this is the
// most expensive thing the app does, so the list buys its variety from how
// different the six are rather than from how many there are.
const DEFAULT_SEARCH: PlaceSearchSpec = {
  includedTypes: [
    'restaurant',
    'park',
    'beach',
    'movie_theater',
    'shopping_mall',
    'tourist_attraction',
  ],
  radiusMeters: 8000,
};

const PRICE_LEVEL_LABELS: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

// Google returns a specific primary type such as 'hamburger_restaurant', so
// matching on the whole name would need hundreds of entries. These are the
// distinctive ones; anything ending in a familiar suffix is caught by
// iconForPlaceType below, and the rest get a map pin.
const PLACE_TYPE_ICONS: Record<string, string> = {
  beach: 'umbrella-outline',
  campground: 'bonfire-outline',
  rv_park: 'bonfire-outline',
  hiking_area: 'trail-sign-outline',
  national_park: 'leaf-outline',
  state_park: 'leaf-outline',
  park: 'leaf-outline',
  city_park: 'leaf-outline',
  dog_park: 'paw-outline',
  botanical_garden: 'leaf-outline',
  library: 'library-outline',
  book_store: 'book-outline',
  movie_theater: 'film-outline',
  performing_arts_theater: 'musical-notes-outline',
  art_gallery: 'color-palette-outline',
  art_museum: 'color-palette-outline',
  museum: 'business-outline',
  amusement_center: 'game-controller-outline',
  amusement_park: 'game-controller-outline',
  video_arcade: 'game-controller-outline',
  bowling_alley: 'game-controller-outline',
  shopping_mall: 'bag-handle-outline',
  department_store: 'bag-handle-outline',
  clothing_store: 'bag-handle-outline',
  gym: 'barbell-outline',
  fitness_center: 'barbell-outline',
  sports_complex: 'basketball-outline',
  tourist_attraction: 'map-outline',
  live_music_venue: 'musical-notes-outline',
  convention_center: 'business-outline',
  non_profit_organization: 'business-outline',
  // Google uses the bare type as well as the specific ones, so 'restaurant'
  // needs its own entry: the '_restaurant' suffix below does not match it.
  restaurant: 'restaurant-outline',
  bakery: 'storefront-outline',
  grocery_store: 'storefront-outline',
  historical_landmark: 'map-outline',
  casino: 'dice-outline',
  stadium: 'basketball-outline',
  ice_skating_rink: 'snow-outline',
  swimming_pool: 'water-outline',
  hotel: 'bed-outline',
  brewpub: 'beer-outline',
  community_center: 'people-outline',
  association_or_organization: 'people-outline',
  cafe: 'cafe-outline',
  coffee_shop: 'cafe-outline',
  tea_house: 'cafe-outline',
  bar: 'beer-outline',
  donut_shop: 'ice-cream-outline',
  ice_cream_shop: 'ice-cream-outline',
  fast_food_restaurant: 'fast-food-outline',
};

const DEFAULT_ICON = 'location-outline';

export type SuggestedPlace = {
  id: string;
  name: string;
  address: string;

  // Where the place is, so the screen can work out how far away it is. Google
  // reports no distance of its own, and this cannot be a stored distance: the
  // cache is reused across roughly a city block, so the distance has to be
  // measured against wherever the planner is standing when the card renders.
  coords: DeviceCoords | null;
  typeLabel: string | null;
  icon: string;
  rating: number | null;
  priceLabel: string | null;
};

// The raw type is kept beside the card so the list can be interleaved by it,
// and dropped again before the screen ever sees it.
type RankedPlace = { primaryType: string; place: SuggestedPlace };

type PlacesResponse = {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
    primaryType?: string;
    primaryTypeDisplayName?: { text?: string };
    rating?: number;
    priceLevel?: string;
    userRatingCount?: number;
  }[];
};

// A template is more specific than its category, so it wins when both are set.
export function searchSpecFor(
  category: string,
  presetId?: string
): PlaceSearchSpec {
  if (presetId && TEMPLATE_SEARCHES[presetId]) {
    return TEMPLATE_SEARCHES[presetId];
  }

  return CATEGORY_SEARCHES[category] ?? DEFAULT_SEARCH;
}

// A template names the activity, so its list is uniform. Without one the list
// is mixed, and both the labels and the interleaving below follow from that.
export function isTemplateSearch(spec: PlaceSearchSpec): boolean {
  return spec.template === true;
}

export function iconForPlaceType(primaryType?: string): string {
  if (!primaryType) return DEFAULT_ICON;

  const exact = PLACE_TYPE_ICONS[primaryType];
  if (exact) return exact;

  // 'vegan_restaurant', 'asian_fusion_restaurant' and the rest of Google's
  // long tail all end in a type we do have an icon for.
  if (primaryType.endsWith('_restaurant')) return 'restaurant-outline';
  if (primaryType.endsWith('_store')) return 'bag-handle-outline';
  if (primaryType.endsWith('_museum')) return 'business-outline';
  if (primaryType.endsWith('_park')) return 'leaf-outline';
  if (primaryType.endsWith('_bar')) return 'beer-outline';

  return DEFAULT_ICON;
}

// "429 Shoreline Village Dr, Long Beach, CA 90802, USA" reads as
// "429 Shoreline Village Dr, Long Beach" on a card that is two lines tall.
function shortenAddress(formatted: string): string {
  const parts = formatted.split(',').map((part) => part.trim());
  return parts.slice(0, 2).join(', ') || formatted;
}

// A single response really does repeat places: the beach search returned one
// id twice and two different ids for the same Bayshore Beach. Duplicate ids
// also collide on the list key in React. Matching on name and address as well
// catches the second kind while leaving branches of a chain alone, since each
// Target keeps its own street address.
function dedupePlaces(entries: RankedPlace[]): RankedPlace[] {
  const seen = new Set<string>();

  return entries.filter(({ place }) => {
    const identity = `${place.name}|${place.address}`.toLowerCase();

    if (seen.has(place.id) || seen.has(identity)) {
      return false;
    }

    seen.add(place.id);
    seen.add(identity);

    return true;
  });
}

// Takes the best of each type in turn. One search per type already guarantees
// every type is represented, so this decides the order: the top park, the top
// beach, the top trail, then the second of each.
function interleaveBuckets(buckets: RankedPlace[][]): RankedPlace[] {
  const picked: RankedPlace[] = [];

  for (let round = 0; ; round += 1) {
    const before = picked.length;

    for (const bucket of buckets) {
      if (round < bucket.length) picked.push(bucket[round]);
    }

    // Every bucket is exhausted, so there is nothing left to take.
    if (picked.length === before) return picked;
  }
}

// Rounding to three decimals is roughly a city block, so a planner drifting
// down the street reuses the cached answer instead of billing another search.
// Keyed on the exact request, so an overlapping type is searched once: a
// custom Outdoors event and a custom Sports & Fitness event both want 'park'
// and the second one reuses the first one's answer.
// Rounding to three decimals is roughly a city block, so a planner drifting
// down the street reuses the cached answer instead of billing another search.
function requestKey(
  coords: DeviceCoords,
  types: string[],
  spec: PlaceSearchSpec
): string {
  const lat = coords.latitude.toFixed(3);
  const lng = coords.longitude.toFixed(3);
  const excluded = (spec.excludedTypes ?? []).join('+');
  return `${lat},${lng}|${types.join('+')}|${spec.radiusMeters}|${excluded}`;
}

const CACHE_STORAGE_KEY = 'meetagain.places.cache.v2';

// A week. Ratings and opening venues do not move meaningfully in that time,
// and it means rehearsing a demo on Monday still costs nothing on Thursday.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Enough for every template and category in a couple of areas.
const MAX_CACHE_ENTRIES = 200;

type CacheEntry = { at: number; places: RankedPlace[] };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<RankedPlace[]>>();

// The in memory cache used to die with the app, so every launch paid for
// searches it had already made. Keeping it on the device means a planner who
// reopens the app, or a team rehearsing the same walkthrough, searches once.
let hydrated: Promise<void> | null = null;

function hydrate(): Promise<void> {
  if (!hydrated) {
    hydrated = AsyncStorage.getItem(CACHE_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;

        const stored = JSON.parse(raw) as Record<string, CacheEntry>;
        const now = Date.now();

        for (const [key, entry] of Object.entries(stored)) {
          if (now - entry.at < CACHE_TTL_MS) {
            cache.set(key, entry);
          }
        }
      })
      // A cache that cannot be read only costs a search, so never let it stop
      // the screen from loading.
      .catch(() => undefined);
  }

  return hydrated;
}

function persist(): void {
  // Oldest first, so the slice below keeps the freshest entries.
  const entries = [...cache.entries()].sort((a, b) => a[1].at - b[1].at);
  const kept = entries.slice(-MAX_CACHE_ENTRIES);

  cache.clear();
  for (const [key, entry] of kept) cache.set(key, entry);

  AsyncStorage.setItem(
    CACHE_STORAGE_KEY,
    JSON.stringify(Object.fromEntries(kept))
  ).catch(() => undefined);
}

async function requestPlaces(
  coords: DeviceCoords,
  spec: PlaceSearchSpec,
  types: string[],
  limit: number
): Promise<RankedPlace[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.');
  }

  const body: Record<string, unknown> = {
    includedTypes: types,
    maxResultCount: limit,
    rankPreference: 'POPULARITY',
    locationRestriction: {
      circle: {
        center: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        radius: spec.radiusMeters,
      },
    },
  };

  if (spec.excludedTypes) {
    body.excludedTypes = spec.excludedTypes;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
      'X-Ios-Bundle-Identifier': IOS_BUNDLE_ID,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Places search failed (${response.status}).`);
  }

  const data: PlacesResponse = await response.json();

  return (data.places ?? []).flatMap<RankedPlace>((place) => {
    const name = place.displayName?.text;

    // A place missing an id or a name cannot be rendered or selected, and one
    // that is unrated or badly rated is not worth recommending.
    if (!place.id || !name) {
      return [];
    }

    const rating = typeof place.rating === 'number' ? place.rating : null;

    if (rating === null || rating < MIN_RATING) {
      return [];
    }

    if ((place.userRatingCount ?? 0) < MIN_RATING_COUNT) {
      return [];
    }

    return [
      {
        primaryType: place.primaryType ?? '',
        place: {
          id: place.id,
          name,
          address: place.formattedAddress
            ? shortenAddress(place.formattedAddress)
            : '',
          coords:
            typeof place.location?.latitude === 'number' &&
            typeof place.location?.longitude === 'number'
              ? {
                  latitude: place.location.latitude,
                  longitude: place.location.longitude,
                }
              : null,
          // A template speaks for the whole list; without one, each place
          // describes itself.
          typeLabel: spec.label ?? place.primaryTypeDisplayName?.text ?? null,
          icon: spec.icon ?? iconForPlaceType(place.primaryType),
          rating,
          priceLabel: place.priceLevel
            ? PRICE_LEVEL_LABELS[place.priceLevel] ?? null
            : null,
        },
      },
    ];
  });
}

async function cachedSearch(
  coords: DeviceCoords,
  spec: PlaceSearchSpec,
  types: string[],
  limit: number
): Promise<RankedPlace[]> {
  await hydrate();

  const key = requestKey(coords, types, spec);
  const cached = cache.get(key);

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.places;
  }

  // Two mounts in the same tick must not bill two searches.
  const pending = inFlight.get(key);

  if (pending) {
    return pending;
  }

  const request = requestPlaces(coords, spec, types, limit)
    .then((places) => {
      cache.set(key, { at: Date.now(), places });
      persist();
      return places;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);

  return request;
}

export async function fetchNearbyPlaces(
  coords: DeviceCoords,
  category: string,
  presetId?: string
): Promise<SuggestedPlace[]> {
  const spec = searchSpecFor(category, presetId);

  // A template asked for one activity, so one search is both cheaper and
  // better ordered: Google's ranking across a movie theater search is already
  // the order a planner wants.
  if (isTemplateSearch(spec)) {
    const found = await cachedSearch(
      coords,
      spec,
      spec.includedTypes,
      MAX_RESULTS
    );

    return dedupePlaces(found)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.place);
  }

  // A custom event says nothing about the activity, so each type is searched
  // on its own and the best of each are merged. That is one billed search per
  // type, which buys a list where the top beach is not buried under ten parks
  // and nothing has to be scraped off the bottom of the ratings to get there.
  const settled = await Promise.allSettled(
    spec.includedTypes.map((type) =>
      cachedSearch(coords, spec, [type], PER_TYPE_RESULTS)
    )
  );

  const buckets = settled.flatMap((result) =>
    result.status === 'fulfilled' ? [result.value] : []
  );

  // One type failing still leaves a usable list, but if every one failed the
  // planner needs to see the error rather than an empty list.
  if (!buckets.length) {
    throw (settled[0] as PromiseRejectedResult).reason;
  }

  return dedupePlaces(interleaveBuckets(buckets))
    .slice(0, MAX_RESULTS)
    .map((entry) => entry.place);
}

export function clearPlacesCache() {
  cache.clear();
  inFlight.clear();
  hydrated = null;
  AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => undefined);
}
