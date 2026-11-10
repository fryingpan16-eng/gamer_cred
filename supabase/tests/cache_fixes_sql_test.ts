/**
 * Migration 000044: igdb_cache is service-role only.
 *   npm run test:sql -- cache_fixes
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME } from './_setup.ts';

Deno.test('players (and signed-out visitors) cannot read or write the IGDB cache', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.igdb_cache (cache_key, data) values ('game:1', '{"results": []}')`);
  await assertRejects(() => asUser(db, ME, 'select * from public.igdb_cache'), Error, 'permission denied');
  await assertRejects(() => asUser(db, '', 'select * from public.igdb_cache'), Error, 'permission denied');
  await assertRejects(() => asUser(db, ME, `insert into public.igdb_cache (cache_key, data) values ('x', '{}')`), Error, 'permission denied');
  const policies = await asOwner(db, `select 1 from pg_policies where tablename = 'igdb_cache'`);
  assertEquals(policies.length, 0);
});
