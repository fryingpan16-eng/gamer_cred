/**
 * Migration 000052: the game library — private by default, public on request,
 * owner-only writes, guests, blocking, server-owned times, merged game ids,
 * independence from the backlog and ratings, and library_of().
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, setGuest, THIRD } from './_setup.ts';

const add = (db: PGlite, uid: string, gameId: number, platformId = 8, format: string | null = null) =>
  asUser(db, uid, 'insert into public.library_entries (user_id, game_id, platform_id, format, source) values ($1, $2, $3, $4, $5)', [
    uid,
    gameId,
    platformId,
    format,
    'manual',
  ]);
const libraryOf = async (db: PGlite, viewer: string, owner: string) =>
  (
    await asUser<{ game_id: number; platform_id: number }>(
      db,
      viewer,
      'select game_id, platform_id from public.library_entries where user_id = $1 order by game_id, platform_id',
      [owner],
    )
  ).map((r) => `${Number(r.game_id)}@${Number(r.platform_id)}`);
const countOf = async (db: PGlite, viewer: string, owner: string) =>
  (await asUser<{ n: number }>(db, viewer, 'select count(*)::int n from public.library_entries where user_id = $1', [owner]))[0]!.n;
const makePublic = (db: PGlite, uid: string, visibility: 'public' | 'private') =>
  asUser(db, uid, 'update public.profiles set library_visibility = $2 where id = $1', [uid, visibility]);

Deno.test('private by default: only the owner sees rows or counts; public opens it; writes stay owner-only', async () => {
  const db = await freshDb();
  await add(db, ME, 1, 8);
  await add(db, ME, 1, 48); // the same game on a second platform
  await add(db, ME, 2, 130, 'physical');
  await assertRejects(() => add(db, ME, 1, 8)); // one row per game + platform

  assertEquals(await libraryOf(db, ME, ME), ['1@8', '1@48', '2@130']);
  assertEquals(await libraryOf(db, OTHER, ME), []);
  assertEquals(await countOf(db, OTHER, ME), 0); // no leak through aggregates
  assertEquals((await asUser(db, OTHER, 'select * from public.library_of($1)', [ME])).length, 0);

  await makePublic(db, ME, 'public');
  assertEquals(await libraryOf(db, OTHER, ME), ['1@8', '1@48', '2@130']);
  assertEquals(await countOf(db, OTHER, ME), 3);
  await assertRejects(() => asUser(db, ME, `update public.profiles set library_visibility = 'friends' where id = $1`, [ME]));

  // Others can't add to, change or remove from it.
  await assertRejects(() => asUser(db, OTHER, 'insert into public.library_entries (user_id, game_id, platform_id) values ($1, 3, 8)', [ME]));
  await asUser(db, OTHER, `update public.library_entries set format = 'digital'`);
  await asUser(db, OTHER, 'delete from public.library_entries');
  assertEquals(await countOf(db, ME, ME), 3);
  assertEquals((await asOwner<{ format: string | null }>(db, `select format from public.library_entries where game_id = 2`))[0]!.format, 'physical');

  // The owner can.
  await asUser(db, ME, `update public.library_entries set format = 'digital' where game_id = 2`);
  await asUser(db, ME, 'delete from public.library_entries where game_id = 1 and platform_id = 48');
  assertEquals(await libraryOf(db, ME, ME), ['1@8', '2@130']);

  await makePublic(db, ME, 'private');
  assertEquals(await countOf(db, OTHER, ME), 0);
});

Deno.test('bad values are refused: unknown format, GamerCred-only platform ids, odd sources', async () => {
  const db = await freshDb();
  await assertRejects(() => add(db, ME, 1, 8, 'cartridge'));
  await assertRejects(() => add(db, ME, 1, -1)); // PC Handheld isn't a release platform
  await assertRejects(() => asUser(db, ME, `insert into public.library_entries (user_id, game_id, platform_id, source) values ($1, 1, 8, 'Steam!')`, [ME]));
  await add(db, ME, 1, 8, null); // format is optional
  assertEquals(await countOf(db, ME, ME), 1);
});

Deno.test('added_at is server-owned; the owner and time never change on update', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.library_entries (user_id, game_id, platform_id, added_at) values ($1, 1, 8, '2001-01-01')`, [ME]);
  const [row] = await asOwner<{ added_at: Date }>(db, `select added_at from public.library_entries`);
  assertEquals(row!.added_at.getUTCFullYear() > 2001, true);
  await asUser(db, ME, `update public.library_entries set added_at = '2001-01-01', format = 'digital'`);
  const [after] = await asOwner<{ added_at: Date }>(db, `select added_at from public.library_entries`);
  assertEquals(after!.added_at.getTime(), row!.added_at.getTime());
});

Deno.test('blocked players never see each other’s public library; guests cannot add', async () => {
  const db = await freshDb();
  await add(db, ME, 1);
  await makePublic(db, ME, 'public');
  await asUser(db, ME, 'select public.block_user($1)', [OTHER]);
  assertEquals(await countOf(db, OTHER, ME), 0);
  assertEquals(await countOf(db, THIRD, ME), 1);
  await setGuest(db, true);
  await assertRejects(() => add(db, THIRD, 9));
  await assertRejects(async () => {
    const rows = await asUser(db, ME, `update public.library_entries set format = 'digital' returning 1`);
    if (rows.length === 0) throw new Error('refused');
  });
});

Deno.test('independent of the backlog and ratings', async () => {
  const db = await freshDb();
  await asUser(db, ME, 'insert into public.game_backlog (user_id, game_id) values ($1, 1)', [ME]);
  await add(db, ME, 1);
  await asOwner(db, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ('${ME}', 1, 80, 'numeric', '80')`);
  assertEquals(await countOf(db, ME, ME), 1); // rating a game leaves the backlog, not the library
  await asUser(db, ME, 'delete from public.library_entries');
  assertEquals((await asOwner<{ n: number }>(db, `select count(*)::int n from public.game_ratings`))[0]!.n, 1);
});

Deno.test('library_of: title, year, the platform’s generation and the owner’s rating', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.games (igdb_id, name, release_year) values (1, 'Alpha', 2004)`);
  await add(db, ME, 1, 8); // PS2 = Gen 6
  await add(db, ME, 2, 6); // PC, no games row yet
  await asOwner(db, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ('${ME}', 1, 91, 'numeric', '91')`);
  const rows = await asUser<{ game_id: number; name: string | null; release_year: number | null; generation: string | null; rating: number | null }>(
    db,
    ME,
    'select game_id, name, release_year, generation, rating from public.library_of($1) order by game_id',
    [ME],
  );
  assertEquals(
    rows.map((r) => [Number(r.game_id), r.name, r.release_year, r.generation, r.rating]),
    [
      [1, 'Alpha', 2004, '6', 91],
      [2, null, null, 'pc', null],
    ],
  );
});

Deno.test('merged game ids: rows move to the original once per platform; later saves land there', async () => {
  const db = await freshDb();
  await add(db, ME, 100, 8);
  await add(db, ME, 100, 48);
  await add(db, ME, 200, 8); // already owns the original on PS2
  await add(db, OTHER, 100, 8);
  await asOwner(db, 'select public.merge_game_version(100, 200)');
  assertEquals(await libraryOf(db, ME, ME), ['200@8', '200@48']);
  assertEquals(await libraryOf(db, OTHER, OTHER), ['200@8']);
  await add(db, THIRD, 100, 130);
  assertEquals(await libraryOf(db, THIRD, THIRD), ['200@130']);
});
