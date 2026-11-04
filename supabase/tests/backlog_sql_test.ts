/**
 * Migration 000035: the backlog — privacy, ownership, guests, blocking, and
 * leaving the backlog when a game goes into Now Playing.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, setGuest, THIRD } from './_setup.ts';

const add = (db: PGlite, uid: string, gameId: number) =>
  asUser(db, uid, 'insert into public.game_backlog (user_id, game_id) values ($1, $2)', [uid, gameId]);
const backlogOf = async (db: PGlite, viewer: string, owner: string) =>
  (await asUser<{ game_id: number }>(db, viewer, 'select game_id from public.game_backlog where user_id = $1 order by created_at, game_id', [owner])).map((r) =>
    Number(r.game_id),
  );

Deno.test('public by default; private hides it from everyone else; only the owner edits', async () => {
  const db = await freshDb();
  await add(db, ME, 1);
  await add(db, ME, 2);
  await assertRejects(() => asUser(db, OTHER, 'insert into public.game_backlog (user_id, game_id) values ($1, 3)', [ME]));
  assertEquals(await backlogOf(db, OTHER, ME), [1, 2]);

  await asUser(db, ME, `update public.profiles set backlog_visibility = 'private' where id = $1`, [ME]);
  assertEquals(await backlogOf(db, OTHER, ME), []);
  assertEquals(await backlogOf(db, ME, ME), [1, 2]); // you always see yours
  await assertRejects(() => asUser(db, ME, `update public.profiles set backlog_visibility = 'friends' where id = $1`, [ME]));

  await asUser(db, OTHER, 'delete from public.game_backlog'); // not theirs: nothing happens
  assertEquals(await backlogOf(db, ME, ME), [1, 2]);
});

Deno.test('blocked players never see each other’s backlog; guests cannot add', async () => {
  const db = await freshDb();
  await add(db, ME, 1);
  await asUser(db, ME, 'select public.block_user($1)', [OTHER]);
  assertEquals(await backlogOf(db, OTHER, ME), []);
  assertEquals(await backlogOf(db, THIRD, ME), [1]);
  await setGuest(db, true);
  await assertRejects(() => add(db, THIRD, 9));
});

Deno.test('rating a game takes it off the backlog; starting it in Now Playing does not', async () => {
  const db = await freshDb();
  await add(db, ME, 1);
  await add(db, ME, 2);
  await asOwner(db, `insert into public.now_playing (user_id, slot_index, game_id) values ('${ME}', 1, 1)`);
  assertEquals(await backlogOf(db, ME, ME), [1, 2]); // still there while playing
  await asOwner(db, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ('${ME}', 1, 80, 'numeric', '80')`);
  assertEquals(await backlogOf(db, ME, ME), [2]);
  // A published review sets the rating too (sync trigger), so it also counts.
  await asOwner(
    db,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ('${ME}', 2, 90, 'numeric', '90', 'great', 'published')`,
  );
  assertEquals(await backlogOf(db, ME, ME), []);
});
