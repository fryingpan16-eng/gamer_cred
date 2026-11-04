/**
 * Migration 000029: game likes — permissions, friends feed, "Most liked" smart
 * lists, liked-games stats and the series backfill.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, setGuest, THIRD } from './_setup.ts';

const like = (db: PGlite, uid: string, gameId: number) =>
  asUser(db, uid, 'insert into public.game_likes (user_id, game_id) values ($1, $2)', [uid, gameId]);

async function seedGames(db: PGlite) {
  await asOwner(
    db,
    `insert into public.games (igdb_id, name, release_year, genres, developers, entry_type, series) values
       (1, 'Zelda A', 1998, '{"Adventure"}', '{"Nintendo EAD"}', 'game', '{"The Legend of Zelda"}'),
       (2, 'Zelda B', 2017, '{"Adventure","Role-playing (RPG)"}', '{"Nintendo EPD"}', 'game', '{"The Legend of Zelda"}'),
       (3, 'Halo', 2001, '{"Shooter"}', '{"Bungie"}', 'game', '{"Halo"}'),
       (4, 'Mystery', null, '{}', '{}', 'game', '{}'),
       (5, 'Big DLC', 2015, '{"Role-playing (RPG)"}', '{"CD Projekt RED"}', 'expansion', '{}')`,
  );
}

Deno.test('players like and unlike their own games only; everyone signed in can read; guests cannot like', async () => {
  const db = await freshDb();
  await like(db, ME, 1);
  await assertRejects(() => like(db, ME, 1)); // once per game
  await assertRejects(() => asUser(db, ME, 'insert into public.game_likes (user_id, game_id) values ($1, 2)', [OTHER]));
  assertEquals((await asUser(db, OTHER, 'select * from public.game_likes')).length, 1);
  await asUser(db, OTHER, 'delete from public.game_likes'); // not theirs: nothing happens
  assertEquals((await asOwner(db, 'select * from public.game_likes')).length, 1);
  await asUser(db, ME, 'delete from public.game_likes where game_id = 1');
  assertEquals((await asOwner(db, 'select * from public.game_likes')).length, 0);

  await setGuest(db, true);
  await assertRejects(() => like(db, ME, 3));
});

Deno.test("friends' likes show in the Friends feed (not Community)", async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.friendships (user_id, friend_id, status) values ('${ME}', '${OTHER}', 'accepted')`);
  await like(db, OTHER, 3);
  await like(db, THIRD, 2); // not a friend
  const friends = await asUser<{ kind: string; game_id: number; actor_username: string }>(db, ME, `select * from public.activity_feed('friends')`);
  assertEquals(
    friends.map((f) => [f.kind, Number(f.game_id), f.actor_username]),
    [['like', 3, 'other']],
  );
  assertEquals((await asUser(db, ME, `select * from public.activity_feed('community')`)).length, 0);
});

Deno.test('"Most liked" smart lists rank by likes and keep the type, year, genre and tier filters', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`);
  await seedGames(db);
  for (const [uid, games] of [
    [ME, [1, 2, 3, 5]],
    [OTHER, [2, 3, 5]],
    [THIRD, [2]],
  ] as const) {
    for (const g of games) await like(db, uid, g);
  }
  const listOf = async (rule: Record<string, unknown>) => {
    const id = (
      await asUser<{ id: string }>(db, ME, `insert into public.lists (user_id, title, smart_rule) values ($1, 'L', $2::jsonb) returning id`, [
        ME,
        JSON.stringify({ rankBy: 'likes', ...rule }),
      ])
    )[0]!.id;
    return (await asUser<{ r: { games: { gameId: number; likeCount: number }[] } }>(db, OTHER, 'select public.smart_list_games($1) as r', [id]))[0]!.r;
  };
  const all = await listOf({ entryTypes: ['game'] });
  assertEquals(
    all.games.map((g) => [Number(g.gameId), g.likeCount]),
    [
      [2, 3],
      [3, 2],
      [1, 1],
    ],
  );
  assertEquals((await listOf({ entryTypes: ['expansion'] })).games.map((g) => Number(g.gameId)), [5]);
  assertEquals((await listOf({ entryTypes: ['game'], yearFrom: 2000, yearTo: 2009 })).games.map((g) => Number(g.gameId)), [3]);
  assertEquals((await listOf({ entryTypes: ['game', 'expansion'], genres: ['Role-playing (RPG)'] })).games.map((g) => Number(g.gameId)), [2, 5]);
  // Tier filters need a Gamer Cred average; unrated games drop out.
  await asOwner(db, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ('${ME}', 3, 98, 'numeric', '98')`);
  assertEquals((await listOf({ entryTypes: ['game'], tiers: ['S'] })).games.map((g) => Number(g.gameId)), [3]);
});

Deno.test('stats: liked games by series, studio, genre and era (Unknown for missing data)', async () => {
  const db = await freshDb();
  await seedGames(db);
  for (const g of [1, 2, 3, 4]) await like(db, ME, g);
  await like(db, OTHER, 5); // someone else's
  const stat = async (dim: string) =>
    (await asUser<{ label: string; games: number; total_labels: number }>(db, ME, 'select * from public.stats_liked($1)', [dim])).map((r) => [
      r.label,
      Number(r.games),
    ]);
  assertEquals(await stat('series'), [
    ['The Legend of Zelda', 2],
    ['Halo', 1],
    ['Unknown', 1],
  ]);
  assertEquals((await stat('genres'))[0], ['Adventure', 2]);
  assertEquals(await stat('era'), [
    ['1990s', 1],
    ['2000s', 1],
    ['2010s', 1],
    ['Unknown', 1],
  ]);
  assertEquals((await stat('studios')).length, 4);
  await assertRejects(() => asUser(db, ME, `select * from public.stats_liked('nope')`));
});

Deno.test('series are backfilled from cached game pages', async () => {
  const db = await freshDb({
    through: 28,
    beforeMigrations: `insert into public.igdb_cache (cache_key, data) values
      ('game:v1:igdb:7', '{"results":[{"id":7,"name":"Metroid"}]}'),
      ('game-detail:v1:igdb+rawg:7', '{"results":[{"id":7,"name":"Metroid","franchises":["Metroid"]}]}')`,
  });
  await db.exec(await Deno.readTextFile(new URL('../migrations/000029_game_likes.sql', import.meta.url)));
  const rows = await asOwner<{ series: string[] }>(db, 'select series from public.games where igdb_id = 7');
  assertEquals(rows[0]?.series, ['Metroid']);
});
