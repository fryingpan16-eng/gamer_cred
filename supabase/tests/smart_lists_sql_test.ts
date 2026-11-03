/**
 * Migration 000023: admin-only smart lists, computed live from game_ratings.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { RATING_TIERS } from '../../src/constants/ratingRubric.ts';
import { asOwner, asUser, freshDb, ME, OTHER } from './_setup.ts';

type SmartResult = {
  requirements: Record<string, number>;
  games: { rank: number; gameId: number; average: number; ratingCount: number }[];
};

let raters = 0;

async function setup(): Promise<PGlite> {
  raters = 0;
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`);
  await asOwner(
    db,
    `insert into public.games (igdb_id, name, release_year, genres, entry_type) values
       (1, 'RPG 2005', 2005, '{"Role-playing (RPG)"}', 'game'),
       (2, 'Shooter 2015', 2015, '{"Shooter"}', 'game'),
       (3, 'Racer 2003', 2003, '{"Racing"}', 'game'),
       (4, 'Niche 2010', 2010, '{"Puzzle"}', 'game'),
       (5, 'Big Expansion', 2012, '{"Role-playing (RPG)"}', 'expansion'),
       (6, 'Small Expansion', 2013, '{"Shooter"}', 'expansion')`,
  );
  return db;
}

/** One rating per new player, so a game can collect any number of ratings. */
async function rate(db: PGlite, gameId: number, scores: number[], platformId: number | null = null) {
  for (const score of scores) {
    const uid = `10000000-0000-0000-0000-${String(++raters).padStart(12, '0')}`;
    await asOwner(db, `insert into public.profiles (id, username) values ('${uid}', 'p${raters}')`);
    await asOwner(
      db,
      `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, platform_id)
       values ('${uid}', ${gameId}, ${score}, 'numeric', '${score}', ${platformId ?? 'null'})`,
    );
  }
}

const smartList = async (db: PGlite, rule: Record<string, unknown>, opts: { isPublic?: boolean } = {}) =>
  (
    await asUser<{ id: string }>(
      db,
      ME,
      `insert into public.lists (user_id, title, is_public, smart_rule) values ($1, 'Smart', $2, $3::jsonb) returning id`,
      [ME, opts.isPublic ?? true, JSON.stringify(rule)],
    )
  )[0]!.id;

const run = async (db: PGlite, uid: string, listId: string) =>
  (await asUser<{ r: SmartResult | null }>(db, uid, 'select public.smart_list_games($1) as r', [listId]))[0]!.r;

const ids = (r: SmartResult | null) => r?.games.map((g) => Number(g.gameId)) ?? [];

/** Ratings used by most tests. */
async function seedGames(db: PGlite) {
  await rate(db, 1, [98, 97, 96, 99, 97, 97]); // 6 ratings, avg 97.3 → S
  await rate(db, 2, [90, 92, 91, 90, 92, 91]); // 6 ratings, avg 91 → A+
  await rate(db, 3, [85, 80, 82, 81, 84, 83]); // 6 ratings, avg 82.5 → A
  await rate(db, 4, [100, 100]); //             2 ratings: under the bar
  await rate(db, 5, [96, 97, 98]); //            expansion, 3 ratings
  await rate(db, 6, [99]); //                    expansion, 1 rating
}

Deno.test('tier labels match the app rubric for every score', async () => {
  const db = await setup();
  const rows = await asOwner<{ s: number; label: string }>(db, 'select s, public.tier_label_for_score(s) as label from generate_series(1, 100) s');
  for (const { s, label } of rows) {
    const def = RATING_TIERS.find((t) => s >= t.min && s <= t.max)!;
    assertEquals(label, def.label, `score ${s}`);
  }
});

Deno.test('ranks by plain average; the bar is the 75th percentile of rating counts per type (min 3)', async () => {
  const db = await setup();
  await seedGames(db);
  // Games' counts [2, 6, 6, 6] → 75th percentile 6 → need 6. Expansions [1, 3] → 2.5 → 3 (and the floor is 3).
  const games = await run(db, OTHER, await smartList(db, { entryTypes: ['game'], limit: 500 }));
  assertEquals(games?.requirements, { game: 6 });
  assertEquals(ids(games), [1, 2, 3]);
  assertEquals(games?.games[0], { rank: 1, gameId: 1, average: 97.3, ratingCount: 6 });

  const expansions = await run(db, OTHER, await smartList(db, { entryTypes: ['expansion'] }));
  assertEquals(expansions?.requirements, { expansion: 3 });
  assertEquals(ids(expansions), [5]);
});

Deno.test('the bar rises as other games collect more ratings', async () => {
  const db = await setup();
  await seedGames(db);
  const id = await smartList(db, { entryTypes: ['expansion'] });
  assertEquals(ids(await run(db, OTHER, id)), [5]);
  await rate(db, 6, [90, 91, 92, 93, 94, 95, 96]); // now 8 ratings → counts [3, 8] → 75th percentile 6.75 → 7
  const after = await run(db, OTHER, id);
  assertEquals(after?.requirements, { expansion: 7 });
  assertEquals(ids(after), [6]);
});

Deno.test('filters: tier, years, genre, platform and limit', async () => {
  const db = await setup();
  await seedGames(db);
  assertEquals(ids(await run(db, OTHER, await smartList(db, { entryTypes: ['game'], tiers: ['S'] }))), [1]);
  assertEquals(ids(await run(db, OTHER, await smartList(db, { entryTypes: ['game'], tiers: ['A+', 'A'] }))), [2, 3]);
  assertEquals(ids(await run(db, OTHER, await smartList(db, { entryTypes: ['game'], yearFrom: 2000, yearTo: 2009 }))), [1, 3]);
  assertEquals(ids(await run(db, OTHER, await smartList(db, { entryTypes: ['game', 'expansion'], genres: ['Role-playing (RPG)'] }))), [1, 5]);
  assertEquals(ids(await run(db, OTHER, await smartList(db, { entryTypes: ['game'], limit: 2 }))), [1, 2]);

  // Platform: only ratings played on it count, and the bar is worked out on those ratings.
  await rate(db, 2, [70, 72, 71], 130);
  await rate(db, 3, [95, 96, 97], 130);
  const onSwitch = await run(db, OTHER, await smartList(db, { entryTypes: ['game'], platformId: 130 }));
  assertEquals(onSwitch?.requirements, { game: 3 });
  assertEquals(ids(onSwitch), [3, 2]);
});

Deno.test('only admins make smart lists; their games cannot be added by hand; private ones stay private', async () => {
  const db = await setup();
  await seedGames(db);
  await assertRejects(() =>
    asUser(db, OTHER, `insert into public.lists (user_id, title, smart_rule) values ($1, 'Nope', '{"entryTypes":["game"]}')`, [OTHER]),
  );
  const own = (
    await asUser<{ id: string }>(db, OTHER, `insert into public.lists (user_id, title) values ($1, 'Mine') returning id`, [OTHER])
  )[0]!.id;
  await assertRejects(() => asUser(db, OTHER, `update public.lists set smart_rule = '{}' where id = $1`, [own]));

  const id = await smartList(db, { entryTypes: ['game'] });
  const ranked = await asOwner<{ is_ranked: boolean }>(db, `select is_ranked from public.lists where id = '${id}'`);
  assertEquals(ranked[0]!.is_ranked, true);
  await assertRejects(() => asUser(db, ME, 'select public.add_list_item($1, 1)', [id]));

  const hidden = await smartList(db, { entryTypes: ['game'] }, { isPublic: false });
  assertEquals(await run(db, OTHER, hidden), null);
  assertEquals(ids(await run(db, ME, hidden)), [1, 2, 3]);
  // A normal list isn't smart.
  assertEquals(await run(db, OTHER, own), null);
});
