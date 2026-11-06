import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportChunks, buildImportRange, parseBusyIntervals } from '../src/features/calendar/googleCalendarHelpers.ts';
import { clearAllGoogleCalendarTokens, clearGoogleCalendarToken, getGoogleCalendarToken, rememberGoogleCalendarToken } from '../src/features/calendar/googleCalendarTokenCache.ts';

test('buildImportRange covers 120 days from local midnight', () => {
  const { start, end } = buildImportRange(new Date(2026, 10, 5, 17, 45));
  assert.equal(start.getHours(), 0);
  assert.equal(start.getDate(), 5);
  assert.equal(end.getTime() - start.getTime(), 120 * 24 * 60 * 60 * 1000);
});

test('parseBusyIntervals accepts an empty calendar and valid busy intervals', () => {
  assert.deepEqual(parseBusyIntervals([]), []);
  assert.deepEqual(parseBusyIntervals([{ start: '2026-11-05T10:00:00Z', end: '2026-11-05T11:00:00Z' }]), [
    { start: '2026-11-05T10:00:00Z', end: '2026-11-05T11:00:00Z' },
  ]);
});

test('buildImportChunks covers 120 days in exactly two contiguous 60-day chunks across DST', () => {
  const { start, end } = buildImportRange(new Date(2026, 9, 31, 17));
  const chunks = buildImportChunks(start, end);
  assert.equal(chunks[0].start.getTime(), start.getTime());
  assert.equal(chunks.at(-1).end.getTime(), end.getTime());
  assert.equal(chunks.length, 2);
  for (let i = 0; i < chunks.length; i++) {
    assert.ok(chunks[i].end > chunks[i].start);
    assert.equal(chunks[i].end.getTime() - chunks[i].start.getTime(), 60 * 24 * 60 * 60 * 1000);
    if (i) assert.equal(chunks[i].start.getTime(), chunks[i - 1].end.getTime());
  }
});

test('parseBusyIntervals rejects malformed and reversed intervals', () => {
  assert.throws(() => parseBusyIntervals(null), /invalid calendar response/);
  assert.throws(() => parseBusyIntervals([{ start: 'bad', end: 'also bad' }]), /invalid busy interval/);
  assert.throws(() => parseBusyIntervals([{ start: '2026-11-05T11:00:00Z', end: '2026-11-05T10:00:00Z' }]), /invalid busy interval/);
});

test('Google access tokens are isolated by user and expire within one hour', () => {
  clearAllGoogleCalendarTokens();
  rememberGoogleCalendarToken('user-a', 'token-a', 120, 1000);
  rememberGoogleCalendarToken('user-b', 'token-b', 7200, 1000);
  assert.equal(getGoogleCalendarToken('user-a', 120999), 'token-a');
  assert.equal(getGoogleCalendarToken('user-a', 121000), null);
  assert.equal(getGoogleCalendarToken('user-b', 3600999), 'token-b');
  assert.equal(getGoogleCalendarToken('user-b', 3601000), null);
  rememberGoogleCalendarToken('user-a', 'token-a');
  clearGoogleCalendarToken('user-a');
  assert.equal(getGoogleCalendarToken('user-a'), null);
});

test('Google access tokens survive a module reload in the same tab session', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage });
  try {
    const cache = await import('../src/features/calendar/googleCalendarTokenCache.ts?session-test');
    cache.clearAllGoogleCalendarTokens();
    cache.rememberGoogleCalendarToken('user-a', 'reload-token', 120, 1000);
    const reloadedCache = await import('../src/features/calendar/googleCalendarTokenCache.ts?session-test-reload');
    assert.equal(reloadedCache.getGoogleCalendarToken('user-a', 119999), 'reload-token');
    assert.equal(reloadedCache.getGoogleCalendarToken('user-b', 119999), null);
    assert.equal(reloadedCache.getGoogleCalendarToken('user-a', 121000), null);
    assert.equal(storage.length, 0);

    storage.setItem('meetagain:google-calendar-token:user-a', '{broken');
    assert.equal(reloadedCache.getGoogleCalendarToken('user-a', 1000), null);
    assert.equal(storage.length, 0);
    cache.rememberGoogleCalendarToken('user-a', 'logout-token', 120, 1000);
    cache.clearAllGoogleCalendarTokens();
    assert.equal(storage.length, 0);
  } finally {
    delete globalThis.sessionStorage;
  }
});
