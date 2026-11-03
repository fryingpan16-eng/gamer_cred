import { assertEquals, assertNotEquals } from '@std/assert';

import { cacheFreshness, computeRulesVersion, SEARCH_REFRESH_AFTER_MS } from './cache_policy.ts';

const HOUR = 60 * 60 * 1000;
const games = { ttlMs: 24 * HOUR, refreshAfterMs: 6 * HOUR, currentRulesVersion: 'abc', rulesVersion: 'abc' };

Deno.test('search freshness: fresh → revalidate in background → expired', () => {
  assertEquals(cacheFreshness({ ...games, ageMs: 1 * HOUR }), 'fresh');
  assertEquals(cacheFreshness({ ...games, ageMs: 6 * HOUR }), 'revalidate');
  assertEquals(cacheFreshness({ ...games, ageMs: 23 * HOUR }), 'revalidate');
  assertEquals(cacheFreshness({ ...games, ageMs: 24 * HOUR }), 'expired');
});

Deno.test('a rules change expires entries regardless of age (the stale "pokemon" bug)', () => {
  assertEquals(cacheFreshness({ ...games, ageMs: 60_000, rulesVersion: 'old' }), 'expired');
  assertEquals(cacheFreshness({ ...games, ageMs: 60_000, rulesVersion: undefined }), 'expired'); // pre-stamp rows
});

Deno.test('unstamped data (RAWG) ignores rule changes and never background-refreshes', () => {
  const rawg = { ttlMs: 14 * 24 * HOUR, refreshAfterMs: SEARCH_REFRESH_AFTER_MS.creators };
  assertEquals(SEARCH_REFRESH_AFTER_MS.creators, null);
  assertEquals(cacheFreshness({ ...rawg, ageMs: 10 * 24 * HOUR }), 'fresh');
  assertEquals(cacheFreshness({ ...rawg, ageMs: 14 * 24 * HOUR }), 'expired');
});

Deno.test('rules version: stable for the same rules, different when any rule changes', async () => {
  const rulesA = { MIN_RATING_COUNT: 5, STORES: new Set([1, 5]), keep: (n: number) => n > 0 };
  const same = await computeRulesVersion([rulesA, 'fields name']);
  assertEquals(await computeRulesVersion([{ ...rulesA }, 'fields name']), same);
  assertEquals(same.length, 12);
  assertNotEquals(await computeRulesVersion([{ ...rulesA, MIN_RATING_COUNT: 6 }, 'fields name']), same); // constant
  assertNotEquals(await computeRulesVersion([{ ...rulesA, keep: (n: number) => n > 1 }, 'fields name']), same); // logic
  assertNotEquals(await computeRulesVersion([rulesA, 'fields name,slug']), same); // query fields
  assertNotEquals(await computeRulesVersion([{ ...rulesA, STORES: new Set([1, 5, 26]) }, 'fields name']), same); // sets
});
