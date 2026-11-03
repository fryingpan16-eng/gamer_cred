/**
 * Runs migrations 000014 + 000015 (games table, stats_* functions) against a real
 * in-process Postgres (PGlite) and checks every aggregate.
 *
 *   cd supabase/tests && deno test -A
 *
 * The stub schema and helpers live in _setup.ts.
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals } from '@std/assert';

import { asOwner, asUser as asUserRows, freshDb, ME, numeric, OTHER } from './_setup.ts';

const cachedGame = (id: number, extra: Record<string, unknown>) =>
  `('game:v3:igdb:${id}', '${JSON.stringify({ results: [{ id, kind: 'game', ...extra }] })}'::jsonb, now())`;

async function setup(): Promise<PGlite> {
  // Cached records BEFORE the migrations, to exercise the 000014 backfill.
  const db = await freshDb({
    beforeMigrations: `insert into public.igdb_cache (cache_key, data, updated_at) values
      ${cachedGame(1, { name: 'Halo 3', releaseYear: 2007, rating: 90, genres: ['Shooter'], developers: ['Bungie'] })},
      ${cachedGame(2, { name: 'Destiny', releaseYear: 2014, rating: 70, genres: ['Shooter', 'RPG'], developers: ['Bungie', 'High Moon'] })},
      ${cachedGame(3, { name: 'Celeste', releaseYear: 2018, rating: 92, genres: ['Platform'], developers: ['Maddy Makes Games'] })},
      ${cachedGame(4, { name: 'Mystery', releaseYear: null, rating: null, genres: [], developers: [] })},
      ('search:v3:igdb:games:20:halo', '{"results": []}'::jsonb, now());`,
  });
  // Game 5 was never cached → no metadata at all.
  await asOwner(db, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, platform_id, created_at) values
    ('${ME}', 1, ${numeric(95)}, 169, '2025-01-10'),   -- Halo 3: I rate higher than the community
    ('${ME}', 2, ${numeric(40)}, 169, '2025-01-20'),   -- Destiny: I rate lower; 2 devs, 2 genres
    ('${ME}', 3, ${numeric(92)}, 6,   '2025-03-05'),   -- Celeste: agree
    ('${ME}', 5, ${numeric(40)}, null, '2025-03-07'),  -- not in games table at all
    ('${OTHER}', 1, ${numeric(10)}, 49, '2025-01-01');  -- someone else's review: must never count`);
  // Game 4: logged as an unrated draft.
  await asOwner(db, `insert into public.reviews (user_id, game_id, status, created_at) values ('${ME}', 4, 'draft', '2025-03-06')`);
  return db;
}

const asUser = <T>(db: PGlite, uid: string, sql: string) => asUserRows<T>(db, uid, sql);

Deno.test('backfill copies cached game records into public.games', async () => {
  const db = await setup();
  const rows = await asOwner<{ igdb_id: number; developers: string[]; release_year: number | null }>(
    db,
    'select igdb_id, developers, release_year from public.games order by igdb_id',
  );
  assertEquals(rows.map((r) => Number(r.igdb_id)), [1, 2, 3, 4]); // search rows are not games
  assertEquals(rows[1]!.developers, ['Bungie', 'High Moon']);
  assertEquals(rows[3]!.release_year, null);
});

Deno.test('rating histogram counts only my rated games', async () => {
  const db = await setup();
  const rows = await asUser<{ score: number; games: number }>(db, ME, 'select * from public.stats_rating_histogram()');
  assertEquals(rows.map((r) => [r.score, r.games]), [[40, 2], [92, 1], [95, 1]]);
});

Deno.test('platforms: unspecified platform is its own (Unknown) bucket', async () => {
  const db = await setup();
  const rows = await asUser<{ platform_id: number | null; games: number }>(db, ME, 'select * from public.stats_platforms()');
  assertEquals(rows.map((r) => [r.platform_id === null ? null : Number(r.platform_id), r.games]), [[169, 2], [null, 2], [6, 1]]);
});

Deno.test('developers: multi-dev games count for each; missing data → Unknown; top-N keeps the full total', async () => {
  const db = await setup();
  const all = await asUser<{ developer: string; games: number; total_studios: number }>(db, ME, 'select * from public.stats_developers()');
  assertEquals(all.map((r) => [r.developer, r.games]), [['Bungie', 2], ['Unknown', 2], ['High Moon', 1], ['Maddy Makes Games', 1]]);
  const top2 = await asUser<{ developer: string; total_studios: number }>(db, ME, 'select * from public.stats_developers(2)');
  assertEquals(top2.map((r) => r.developer), ['Bungie', 'Unknown']);
  assertEquals(top2[0]!.total_studios, 4);
});

Deno.test('genres: count per genre and average of rated games only', async () => {
  const db = await setup();
  const rows = await asUser<{ genre: string; games: number; rated_games: number; average_rating: string | null }>(
    db,
    ME,
    'select * from public.stats_genres()',
  );
  const byGenre = Object.fromEntries(rows.map((r) => [r.genre, [r.games, r.rated_games, r.average_rating === null ? null : Number(r.average_rating)]]));
  assertEquals(byGenre, {
    Shooter: [2, 2, 67.5], // (95 + 40) / 2
    Unknown: [2, 1, 40], // game 4 unrated, game 5 rated 40
    Platform: [1, 1, 92],
    RPG: [1, 1, 40],
  });
});

Deno.test('vs community: averages over games with both ratings, hot takes both ways', async () => {
  const db = await setup();
  const [row] = await asUser<{ stats_vs_community: Record<string, unknown> }>(db, ME, 'select public.stats_vs_community(5)');
  const v = row!.stats_vs_community as {
    compared: number;
    my_average: number;
    community_average: number;
    higher: { name: string; diff: number }[];
    lower: { name: string; diff: number }[];
  };
  assertEquals(v.compared, 3);
  assertEquals(Number(v.my_average), 75.7); // (95 + 40 + 92) / 3
  assertEquals(Number(v.community_average), 84);
  assertEquals(v.higher.map((h) => [h.name, h.diff]), [['Halo 3', 5]]);
  assertEquals(v.lower.map((h) => [h.name, h.diff]), [['Destiny', -30]]);
});

Deno.test('release years and monthly timeline', async () => {
  const db = await setup();
  const years = await asUser<{ release_year: number | null; games: number }>(db, ME, 'select * from public.stats_release_years()');
  assertEquals(years.map((r) => [r.release_year, r.games]), [[2007, 1], [2014, 1], [2018, 1], [null, 2]]);
  const months = await asUser<{ month: Date; games: number }>(db, ME, 'select * from public.stats_logged_over_time()');
  assertEquals(months.map((r) => [new Date(r.month).toISOString().slice(0, 7), r.games]), [['2025-01', 2], ['2025-03', 3]]);
});

Deno.test('every stat is scoped to the caller (another user sees only their own)', async () => {
  const db = await setup();
  const hist = await asUser<{ score: number; games: number }>(db, OTHER, 'select * from public.stats_rating_histogram()');
  assertEquals(hist.map((r) => [r.score, r.games]), [[10, 1]]);
  const devs = await asUser<{ developer: string }>(db, OTHER, 'select * from public.stats_developers()');
  assertEquals(devs.map((r) => r.developer), ['Bungie']);
  // Signed out → nothing.
  const anon = await asUser<{ score: number }>(db, '', 'select * from public.stats_rating_histogram()');
  assertEquals(anon.length, 0);
});
