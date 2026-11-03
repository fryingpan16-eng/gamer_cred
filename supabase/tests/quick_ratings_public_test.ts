/**
 * Migration 000016: public quick ratings + "played on" platform.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';

const rate = (db: PGlite, uid: string, gameId: number, score: number, platformId: number | null) =>
  asUser(
    db,
    uid,
    `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, platform_id)
     values ($1, $2, $3, 'numeric', $5, $4)
     on conflict (user_id, game_id) do update
       set rating = excluded.rating, rating_input_scale = excluded.rating_input_scale,
           rating_input = excluded.rating_input, platform_id = excluded.platform_id`,
    [uid, gameId, score, platformId, String(score)],
  );
const platformOf = async (db: PGlite, table: 'game_ratings' | 'reviews', uid: string, gameId: number) =>
  (await asOwner<{ platform_id: number | null }>(db, `select platform_id from public.${table} where user_id = '${uid}' and game_id = ${gameId}`))[0]
    ?.platform_id ?? null;

Deno.test('quick ratings are public to read, but only the owner can write', async () => {
  const db = await freshDb();
  await rate(db, ME, 10, 89, 167);
  const seen = await asUser<{ rating: number; platform_id: number }>(db, OTHER, `select rating, platform_id from public.game_ratings where user_id = '${ME}'`);
  assertEquals(seen.map((r) => [r.rating, Number(r.platform_id)]), [[89, 167]]);
  await asUser(db, OTHER, `update public.game_ratings set rating = 1 where user_id = '${ME}'`);
  await asUser(db, OTHER, `delete from public.game_ratings where user_id = '${ME}'`);
  await assertRejects(() => asUser(db, OTHER, `insert into public.game_ratings values ('${ME}', 11, 1, 'numeric', '1')`));
  assertEquals((await asOwner<{ rating: number }>(db, 'select rating from public.game_ratings')).map((r) => r.rating), [89]);
  // still never a review
  assertEquals(await asOwner(db, 'select * from public.reviews'), []);
});

Deno.test('platform: stored with the rating and kept in sync with the review', async () => {
  const db = await freshDb();
  await rate(db, ME, 1, 80, 8); // PS2
  // A review saved with a platform moves the rating to it...
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, platform_id) values ($1, 1, 80, 'numeric', '80', 48)`, [ME]);
  assertEquals(Number(await platformOf(db, 'game_ratings', ME, 1)), 48);
  // ...changing it on the rating moves the review...
  await rate(db, ME, 1, 80, 167);
  assertEquals(Number(await platformOf(db, 'reviews', ME, 1)), 167);
  // ...and "not specified" on either side keeps the other's platform.
  await asUser(db, ME, 'update public.reviews set platform_id = null where user_id = $1', [ME]);
  assertEquals(Number(await platformOf(db, 'game_ratings', ME, 1)), 167);
  await rate(db, ME, 1, 81, null);
  assertEquals((await asOwner<{ rating: number }>(db, 'select rating from public.reviews'))[0]!.rating, 81);
});

Deno.test('backfill: existing ratings take the platform from the review', async () => {
  const db = await freshDb({ through: 15 });
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, platform_id) values ($1, 1, 70, 'numeric', '70', 130)`, [ME]);
  await db.exec(await Deno.readTextFile(new URL('../migrations/000016_public_ratings_and_platform.sql', import.meta.url)));
  assertEquals(Number(await platformOf(db, 'game_ratings', ME, 1)), 130);
});

Deno.test("friends' ratings include quick ratings, with the review link when published", async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.friendships (user_id, friend_id, status) values
    ('${ME}', '${OTHER}', 'accepted'), ('${THIRD}', '${ME}', 'pending')`);
  await rate(db, OTHER, 1, 75, 6); // quick rating only
  await rate(db, THIRD, 1, 90, 6); // not an accepted friend
  const rows = await asUser<{ username: string; rating: number; review_id: string | null; platform_id: number }>(
    db,
    ME,
    'select * from public.friend_ratings_for_game(1)',
  );
  assertEquals(rows.map((r) => [r.username, r.rating, r.review_id, Number(r.platform_id)]), [['other', 75, null, 6]]);
  await asUser(db, OTHER, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status) values ($1, 1, 75, 'numeric', '75', 'published')`, [OTHER]);
  const [withReview] = await asUser<{ review_id: string | null }>(db, ME, 'select * from public.friend_ratings_for_game(1)');
  assertEquals(typeof withReview!.review_id, 'string');
});

Deno.test('stats use the rating platform for quick-rated games', async () => {
  const db = await freshDb();
  await rate(db, ME, 2, 40, 130);
  const platforms = await asUser<{ platform_id: number; games: number }>(db, ME, 'select * from public.stats_platforms()');
  assertEquals(platforms.map((p) => [Number(p.platform_id), p.games]), [[130, 1]]);
});

Deno.test("a player's ratings list: every rating with game metadata and their published review", async () => {
  const db = await freshDb({
    beforeMigrations: `insert into public.igdb_cache (cache_key, data) values
      ('game:v3:igdb:1', '{"results":[{"id":1,"name":"Halo 3","releaseYear":2007,"rating":90,"genres":["Shooter"],"developers":["Bungie"]}]}')`,
  });
  await rate(db, ME, 1, 80, 12);
  await rate(db, ME, 99, 40, null); // never cached: no metadata
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status) values ($1, 1, 80, 'numeric', '80', 'published')`, [ME]);
  // another player can read the whole list
  const rows = await asUser<{ game_id: number; name: string | null; genres: string[]; release_year: number | null; review_id: string | null; platform_id: number | null }>(
    db,
    OTHER,
    `select * from public.user_ratings_table('${ME}') order by game_id`,
  );
  assertEquals(
    rows.map((r) => [Number(r.game_id), r.name, r.genres, r.release_year, r.review_id !== null]),
    [
      [1, 'Halo 3', ['Shooter'], 2007, true],
      [99, null, [], null, false],
    ],
  );
});
