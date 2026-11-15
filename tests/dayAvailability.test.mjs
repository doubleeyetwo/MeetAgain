import assert from 'node:assert/strict';
import test from 'node:test';
import { getDayAvailability } from '../src/features/events/dayAvailability.ts';

const day = new Date(2026, 10, 16);
const at = (hour, minute = 0) => new Date(2026, 10, 16, hour, minute);
const calendar = (...blocks) => ({
  rangeStart: at(7),
  rangeEnd: at(24),
  lastUpdated: null,
  busy: blocks.map(([start, end]) => ({ start: start.toISOString(), end: end.toISOString() })),
});

test('identical and nested appointments count once across calendars', () => {
  const result = getDayAvailability(day, [
    calendar([at(14), at(14, 15)]),
    calendar([at(14), at(14, 15)], [at(14, 5), at(14, 10)]),
  ]);
  assert.equal(result.freePercentage, 1005 / 1020 * 100);
  assert.equal(result.shade, 'high');
});

test('overlapping blocks only add new busy time and are clipped to the window', () => {
  const result = getDayAvailability(day, [
    calendar([at(6), at(7)], [at(6, 45), at(7, 15)]),
    calendar([at(7, 10), at(7, 30)], [at(23, 59), at(24, 30)]),
  ]);
  assert.equal(result.freePercentage, 989 / 1020 * 100);
});

test('longer busy periods produce darker shades, and a fully busy day stays unshaded', () => {
  assert.equal(getDayAvailability(day, [calendar([at(13), at(15)])]).shade, 'high');
  assert.equal(getDayAvailability(day, [calendar([at(13), at(18)])]).shade, 'medium');
  assert.equal(getDayAvailability(day, [calendar([at(13), at(21)])]).shade, 'low');
  assert.equal(getDayAvailability(day, [calendar([at(7), at(20)])]).shade, 'low');
  assert.deepEqual(getDayAvailability(day, [calendar([at(7), at(24)])]), {
    freePercentage: 0, unknown: 0, shade: null,
  });
});

test('partial coverage is unknown and a day with no known calendars has no score', () => {
  const partial = { ...calendar(), rangeEnd: at(23) };
  assert.deepEqual(getDayAvailability(day, [calendar(), partial, null]), {
    freePercentage: 100, unknown: 2, shade: 'high',
  });
  assert.deepEqual(getDayAvailability(day, [null, partial]), {
    freePercentage: null, unknown: 2, shade: null,
  });
});

test('green requires a continuous 30-minute gap, including at the edges of the window', () => {
  assert.equal(getDayAvailability(day, [calendar([at(7), at(23, 55)])]).shade, null);
  assert.equal(getDayAvailability(day, [
    calendar([at(7, 15), at(8)], [at(8, 15), at(24)]),
  ]).shade, null);
  assert.equal(getDayAvailability(day, [calendar([at(7), at(23, 30)])]).shade, 'low');
  assert.equal(getDayAvailability(day, [calendar([at(7, 30), at(24)])]).shade, 'low');
});
