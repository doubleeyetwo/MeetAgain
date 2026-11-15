const test = require('node:test');
const assert = require('node:assert/strict');

const { loadModule } = require('./screenHarness.cjs');

// Issue #52: a suggestion card says roughly how far away the place is. The
// figure is a straight line, so the card rounds it and marks it approximate.

const { distanceInMiles, formatDistance } = loadModule(
  'src/features/events/distance.ts'
);

const CSULB = { latitude: 33.7838, longitude: -118.1141 };

test('a degree of latitude is sixty nine miles', () => {
  // The textbook figure, which pins the formula without trusting a value this
  // same code produced.
  const miles = distanceInMiles(
    { latitude: 0, longitude: 0 },
    { latitude: 1, longitude: 0 }
  );

  assert.ok(
    Math.abs(miles - 69.09) < 0.05,
    `expected about 69.09 miles, got ${miles}`
  );
});

test('a place measured against itself is not far away', () => {
  assert.equal(distanceInMiles(CSULB, CSULB), 0);
});

test('distance does not depend on which way round it is measured', () => {
  const beach = { latitude: 33.7542, longitude: -118.1157 };

  assert.equal(
    distanceInMiles(CSULB, beach),
    distanceInMiles(beach, CSULB)
  );
});

test('real distances from campus come out right', () => {
  // Checked against the known straight line distances to these places.
  const cases = [
    [{ latitude: 33.8121, longitude: -117.919 }, 11.4, 'Disneyland'],
    [{ latitude: 34.0522, longitude: -118.2437 }, 20.0, 'downtown LA'],
    [{ latitude: 33.6939, longitude: -118.045 }, 7.4, 'Bolsa Chica'],
  ];

  for (const [coords, expected, name] of cases) {
    const miles = distanceInMiles(CSULB, coords);

    assert.ok(
      Math.abs(miles - expected) < 0.3,
      `${name}: expected about ${expected} miles, got ${miles.toFixed(2)}`
    );
  }
});

test('a place across the street does not read as zero miles', () => {
  // Rounding to whole miles would print "~0 mi", which reads like a bug.
  assert.equal(formatDistance(0), '< 1 mi');
  assert.equal(formatDistance(0.2), '< 1 mi');
  assert.equal(formatDistance(0.9), '< 1 mi');
});

test('a distance is rounded to whole miles and marked approximate', () => {
  assert.equal(formatDistance(1), '~1 mi');
  assert.equal(formatDistance(1.4), '~1 mi');
  assert.equal(formatDistance(1.6), '~2 mi');
  assert.equal(formatDistance(11.37), '~11 mi');
});

test('a distance that is not a number shows nothing at all', () => {
  assert.equal(formatDistance(Number.NaN), '');
  assert.equal(formatDistance(-1), '');
});
