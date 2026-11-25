/**
 * Migration 000051: console generations — each game's group, the seeded
 * "Top 250" lists, the game page badge and the Stats breakdown.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { GENERATION_GROUPS, generationListTitle } from '../../src/constants/generations.ts';
import { asOwner, asUser, freshDb, ME, numeric, OTHER } from './_setup.ts';

type Badge = {
  generation: string;
  releaseYear: number | null;
  remakeOf: string | null;
  remasteredFor: string[];
  listId: string | null;
  rank: number | null;
};

let raters = 0;

/** ME is the app owner, so the generation lists exist. */
async function setup(): Promise<PGlite> {
  raters = 0;
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id, is_owner) values ('${ME}', true)`);
  return db;
}

const game = (db: PGlite, id: number, opts: { year?: number; type?: string; launch?: number[]; release?: number[]; remakeOf?: number; remakeOfPlatforms?: number[]; remasters?: number[] }) =>
  asOwner(
    db,
    `insert into public.games (igdb_id, name, release_year, entry_type, launch_platform_ids, release_platform_ids, remake_of, remake_of_platform_ids, remaster_platform_ids)
     values (${id}, 'Game ${id}', ${opts.year ?? 'null'}, '${opts.type ?? 'game'}', '{${(opts.launch ?? []).join(',')}}',
             '{${(opts.release ?? opts.launch ?? []).join(',')}}', ${opts.remakeOf ?? 'null'},
             '{${(opts.remakeOfPlatforms ?? []).join(',')}}', '{${(opts.remasters ?? []).join(',')}}')`,
  );

async function rate(db: PGlite, gameId: number, scores: number[]) {
  for (const score of scores) {
    const uid = `10000000-0000-0000-0000-${String(++raters).padStart(12, '0')}`;
    await asOwner(db, `insert into public.profiles (id, username) values ('${uid}', 'player${raters}')`);
    await asOwner(
      db,
      `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input)
       values ('${uid}', ${gameId}, ${score}, 'numeric', '${score}')`,
    );
  }
}

const groupOf = async (db: PGlite, launch: number[], release: number[] = launch) =>
  (
    await asUser<{ g: string | null }>(db, OTHER, 'select public.platform_group_of($1::bigint[], $2::bigint[]) as g', [
      `{${launch.join(',')}}`,
      `{${release.join(',')}}`,
    ])
  )[0]!.g;

const badge = async (db: PGlite, gameId: number) =>
  (await asUser<{ b: Badge | null }>(db, OTHER, 'select public.game_generation_badge($1) as b', [gameId]))[0]!.b;

const listId = async (db: PGlite, key: string) =>
  (await asOwner<{ id: string }>(db, `select id from public.lists where system_key = 'generation:${key}'`))[0]!.id;

Deno.test('a game’s group: launch consoles beat PC, the oldest console wins; otherwise first listed platform', async () => {
  const db = await setup();
  assertEquals(await groupOf(db, [8]), '6'); // PS2
  assertEquals(await groupOf(db, [130]), '8'); // Switch is Gen 8
  assertEquals(await groupOf(db, [508]), '9'); // Switch 2
  assertEquals(await groupOf(db, [6, 12, 9]), '7'); // PC + 360 + PS3 on day one
  assertEquals(await groupOf(db, [48, 167]), '8'); // cross-gen launch: the older generation
  assertEquals(await groupOf(db, [6]), 'pc');
  assertEquals(await groupOf(db, [16]), 'pc'); // Amiga: old computers count as PC
  assertEquals(await groupOf(db, [82]), 'pc'); // web browser
  assertEquals(await groupOf(db, [39, 34]), 'mobile');
  assertEquals(await groupOf(db, [52]), 'arcade');
  assertEquals(await groupOf(db, [6, 52, 39]), 'pc'); // PC ahead of arcade and mobile
  // Launch platforms not listed (a VR headset): the first listed platform in release order.
  assertEquals(await groupOf(db, [162], [162, 48, 6]), '8');
  assertEquals(await groupOf(db, [162]), null);
  assertEquals(await groupOf(db, []), null);
});

Deno.test('the seeded lists: one per group, titled like the app, owned by the owner, ranked, public', async () => {
  const db = await setup();
  const rows = await asOwner<{ system_key: string; title: string; user_id: string; is_public: boolean; is_ranked: boolean; smart_rule: Record<string, unknown> }>(
    db,
    `select system_key, title, user_id, is_public, is_ranked, smart_rule from public.lists where system_key is not null order by system_key`,
  );
  assertEquals(rows.length, GENERATION_GROUPS.length);
  for (const g of GENERATION_GROUPS) {
    const row = rows.find((r) => r.system_key === `generation:${g.key}`)!;
    assertEquals(row.title, generationListTitle(g));
    assertEquals([row.user_id, row.is_public, row.is_ranked], [ME, true, true]);
    assertEquals(row.smart_rule.generation, g.key);
    assertEquals(row.smart_rule.limit, 250);
    assertEquals(row.smart_rule.entryTypes, ['game', 'remake']);
  }
  // Seeding again changes nothing.
  assertEquals(await asOwner(db, 'select private.seed_generation_lists() as n'), [{ n: 0 }]);
});

Deno.test('no owner yet: lists wait, then appear when an owner is set', async () => {
  const db = await freshDb();
  assertEquals((await asOwner(db, 'select 1 from public.lists where system_key is not null')).length, 0);
  await asOwner(db, `insert into public.app_admins (user_id) values ('${OTHER}')`);
  assertEquals((await asOwner(db, 'select 1 from public.lists where system_key is not null')).length, 0);
  await asOwner(db, `update public.app_admins set is_owner = true where user_id = '${OTHER}'`);
  assertEquals((await asOwner(db, 'select 1 from public.lists where system_key is not null')).length, GENERATION_GROUPS.length);
});

Deno.test('players can’t claim or change a system key', async () => {
  const db = await setup();
  await assertRejects(() =>
    asUser(db, OTHER, `insert into public.lists (user_id, title, system_key) values ($1, 'Fake', 'generation:x')`, [OTHER]),
  );
  const id = await listId(db, '6');
  await assertRejects(() => asUser(db, ME, `update public.lists set system_key = null where id = $1`, [id]));
  // The owner can still rename it.
  await asUser(db, ME, `update public.lists set title = 'Best of Gen 6' where id = $1`, [id]);
});

Deno.test('generation lists: only that generation, games + remakes, bar measured inside the generation', async () => {
  const db = await setup();
  await game(db, 1, { launch: [8] }); //                    Gen 6
  await game(db, 2, { launch: [21] }); //                   Gen 6
  await game(db, 3, { launch: [48] }); //                   Gen 8
  await game(db, 4, { type: 'remake', launch: [167], remakeOf: 1 }); // Gen 9 remake of a Gen 6 game
  await game(db, 5, { type: 'expansion', launch: [8] }); // Gen 6 expansion: left out
  await rate(db, 1, [90, 92, 91]);
  await rate(db, 2, [95, 96, 97]);
  await rate(db, 3, Array(20).fill(99)); // lots of Gen 8 ratings don't raise the Gen 6 bar
  await rate(db, 4, [80, 82, 81]);
  await rate(db, 5, [99, 99, 99]);

  const result = async (key: string) =>
    (await asUser<{ r: { games: { gameId: number; rank: number }[] } }>(db, OTHER, 'select public.smart_list_games($1) as r', [await listId(db, key)]))[0]!
      .r.games.map((g) => Number(g.gameId));
  assertEquals(await result('6'), [2, 1]);
  assertEquals(await result('8'), [3]);
  assertEquals(await result('9'), [4]);
  assertEquals(await result('pc'), []);
});

Deno.test('the badge: group, year, remake / remaster notes, and the rank from the saved list', async () => {
  const db = await setup();
  await game(db, 1, { year: 2001, launch: [8], remasters: [48, 167, 6, 8] }); // Gen 6, remastered for 8 and 9 (PC and Gen 6 don't count)
  await game(db, 2, { year: 2016, launch: [6], remasters: [48] }); //        PC, remastered for Gen 8
  await game(db, 3, { year: 2020, type: 'remake', launch: [167], remakeOf: 99, remakeOfPlatforms: [18] }); // remake of an NES game
  await game(db, 4, { year: 2019, type: 'remake', launch: [48], remakeOf: 1 }); // original's group from its games row
  await game(db, 5, { year: 2018, launch: [162] }); //                       no listed platform
  await rate(db, 1, [90, 91, 92]);

  // Not ranked until the list has been worked out.
  assertEquals((await badge(db, 1))!.rank, null);
  await asOwner(db, 'select public.refresh_all_smart_lists()');

  const one = (await badge(db, 1))!;
  assertEquals([one.generation, one.releaseYear, one.remakeOf, one.remasteredFor, one.rank], ['6', 2001, null, ['8', '9'], 1]);
  assertEquals(one.listId, await listId(db, '6'));
  const two = (await badge(db, 2))!;
  assertEquals([two.generation, two.releaseYear, two.remasteredFor, two.rank], ['pc', 2016, ['8'], null]);
  assertEquals([(await badge(db, 3))!.generation, (await badge(db, 3))!.remakeOf], ['9', '3']);
  assertEquals((await badge(db, 4))!.remakeOf, '6');
  assertEquals(await badge(db, 5), null);
  assertEquals(await badge(db, 12345), null);
});

Deno.test('stats_generations: your logged games and average per group, in generation order', async () => {
  const db = await setup();
  await game(db, 1, { launch: [8] });
  await game(db, 2, { launch: [21] });
  await game(db, 3, { launch: [6] });
  await asOwner(
    db,
    `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values
       ('${ME}', 1, 80, 'numeric', '80'), ('${ME}', 3, 60, 'numeric', '60'), ('${OTHER}', 2, 10, 'numeric', '10')`,
  );
  await asOwner(db, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status) values ('${ME}', 2, ${numeric(90)}, 'published')`);
  await asOwner(db, `insert into public.reviews (user_id, game_id, status) values ('${ME}', 777, 'draft')`); // no catalogue row
  const rows = await asUser<{ generation: string; games: number; rated_games: number; average_rating: string | null }>(
    db,
    ME,
    'select * from public.stats_generations()',
  );
  assertEquals(
    rows.map((r) => [r.generation, r.games, r.rated_games, r.average_rating === null ? null : Number(r.average_rating)]),
    [
      ['6', 2, 2, 85],
      ['pc', 1, 1, 60],
      ['unknown', 1, 0, null],
    ],
  );
});

Deno.test('backfill: release order from cached game records; launch platform = the first one', async () => {
  const db = await freshDb({ through: 50 });
  await asOwner(db, `insert into public.games (igdb_id, name, entry_type) values (1, 'A', 'game'), (2, 'B', 'remake')`);
  await asOwner(
    db,
    `insert into public.igdb_cache (cache_key, data) values
       ('game:v1:igdb:1', '{"results":[{"id":1,"name":"A","releasePlatformIds":[6,48]}]}'),
       ('game:v1:igdb:2', '{"results":[{"id":2,"name":"B","entryType":"remake","parentGame":{"id":1,"name":"A"},"releasePlatformIds":[167]}]}')`,
  );
  await db.exec(await Deno.readTextFile(new URL('../migrations/000051_generations.sql', import.meta.url)));
  const rows = await asOwner<{ igdb_id: number; release_platform_ids: number[]; launch_platform_ids: number[]; remake_of: number | null }>(
    db,
    'select igdb_id, release_platform_ids, launch_platform_ids, remake_of from public.games order by igdb_id',
  );
  assertEquals(
    rows.map((r) => [Number(r.igdb_id), r.release_platform_ids.map(Number), r.launch_platform_ids.map(Number), r.remake_of === null ? null : Number(r.remake_of)]),
    [
      [1, [6, 48], [6], null],
      [2, [167], [167], 1],
    ],
  );
});
