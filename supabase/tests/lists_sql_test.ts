/**
 * Migration 000019: game lists + admin-pinned lists, on real Postgres (PGlite) with RLS.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';

/** ME is made an admin (the migration's hard-coded owner id doesn't exist in tests). */
async function setup(): Promise<PGlite> {
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`);
  return db;
}

const createList = async (db: PGlite, uid: string, title: string, opts: { isPublic?: boolean } = {}) =>
  (
    await asUser<{ id: string }>(
      db,
      uid,
      `insert into public.lists (user_id, title, description, is_public) values ($1, $2, 'desc', $3) returning id`,
      [uid, title, opts.isPublic ?? true],
    )
  )[0]!.id;
const items = async (db: PGlite, uid: string, listId: string) =>
  (await asUser<{ game_id: number }>(db, uid, 'select game_id from public.list_items where list_id = $1 order by position', [listId])).map((r) =>
    Number(r.game_id),
  );

Deno.test('any user creates a list and adds games in order (no duplicates)', async () => {
  const db = await setup();
  const id = await createList(db, OTHER, 'Best RPGs');
  for (const g of [10, 20, 30, 20]) await asUser(db, OTHER, 'select public.add_list_item($1, $2)', [id, g]);
  assertEquals(await items(db, OTHER, id), [10, 20, 30]);
});

Deno.test('reordering moves a game and renumbers 1..n', async () => {
  const db = await setup();
  const id = await createList(db, OTHER, 'Ranked');
  for (const g of [1, 2, 3, 4]) await asUser(db, OTHER, 'select public.add_list_item($1, $2)', [id, g]);
  await asUser(db, OTHER, 'select public.move_list_item($1, 4, 1)', [id]);
  assertEquals(await items(db, OTHER, id), [4, 1, 2, 3]);
  await asUser(db, OTHER, 'select public.move_list_item($1, 4, 99)', [id]); // clamps to the end
  assertEquals(await items(db, OTHER, id), [1, 2, 3, 4]);
  const positions = await asUser<{ position: number }>(db, OTHER, 'select position from public.list_items where list_id = $1 order by position', [id]);
  assertEquals(positions.map((p) => p.position), [1, 2, 3, 4]);
});

Deno.test('RLS: public lists are readable by all, private only by the owner; only the owner edits', async () => {
  const db = await setup();
  const pub = await createList(db, OTHER, 'Public');
  const priv = await createList(db, OTHER, 'Secret', { isPublic: false });
  await asUser(db, OTHER, 'select public.add_list_item($1, 7)', [priv]);
  const seen = await asUser<{ title: string }>(db, THIRD, 'select title from public.lists order by title');
  assertEquals(seen.map((l) => l.title), ['Public']);
  assertEquals(await items(db, THIRD, priv), []); // items of a private list are hidden too
  assertEquals(await items(db, OTHER, priv), [7]);
  // someone else can't add, rename or delete
  await assertRejects(() => asUser(db, THIRD, 'select public.add_list_item($1, 9)', [pub]));
  await asUser(db, THIRD, `update public.lists set title = 'hacked' where id = $1`, [pub]);
  await asUser(db, THIRD, 'delete from public.lists where id = $1', [pub]);
  assertEquals((await asOwner<{ title: string }>(db, `select title from public.lists where id = '${pub}'`))[0]!.title, 'Public');
  // and can't create a list as someone else
  await assertRejects(() => asUser(db, THIRD, `insert into public.lists (user_id, title) values ('${OTHER}', 'x')`));
});

Deno.test('only admins pin lists to Home; pinned lists must be public; a rank holds one list', async () => {
  const db = await setup();
  const a = await createList(db, OTHER, 'Community pick');
  const b = await createList(db, ME, 'Staff picks');
  // a normal user can't pin, even their own list
  await assertRejects(() => asUser(db, OTHER, `update public.lists set pinned_rank = 1 where id = $1`, [a]), Error, 'admins');
  await assertRejects(() => asUser(db, OTHER, 'select public.set_list_pin($1, 1::smallint)', [a]), Error, 'admins');
  // the admin pins anyone's public list
  await asUser(db, ME, 'select public.set_list_pin($1, 1::smallint)', [a]);
  await asUser(db, ME, 'select public.set_list_pin($1, 1::smallint)', [b]); // takes rank 1, a is unpinned
  const pinned = await asUser<{ title: string; pinned_rank: number | null }>(db, THIRD, 'select title, pinned_rank from public.lists order by title');
  assertEquals(pinned.map((l) => [l.title, l.pinned_rank]), [['Community pick', null], ['Staff picks', 1]]);
  // a pinned list can't be made private
  await assertRejects(() => asUser(db, ME, `update public.lists set is_public = false where id = $1`, [b]));
  // the owner can still edit a pinned list's details (pin unchanged)
  await asUser(db, ME, `update public.lists set title = 'Staff Picks 2026' where id = $1`, [b]);
});

Deno.test('search: public lists by title or description, never private ones', async () => {
  const db = await setup();
  await createList(db, OTHER, 'Cozy farming games');
  await createList(db, OTHER, 'Hidden cozy', { isPublic: false });
  const hits = await asUser<{ title: string }>(
    db,
    THIRD,
    `select title from public.lists where is_public and (title ilike '%cozy%' or description ilike '%cozy%')`,
  );
  assertEquals(hits.map((h) => h.title), ['Cozy farming games']);
});

Deno.test('deleting a list removes its games; deleting the account removes its lists', async () => {
  const db = await setup();
  const id = await createList(db, OTHER, 'Temp');
  await asUser(db, OTHER, 'select public.add_list_item($1, 1)', [id]);
  await asUser(db, OTHER, 'delete from public.lists where id = $1', [id]);
  assertEquals(await asOwner(db, 'select * from public.list_items'), []);
  await createList(db, OTHER, 'Another');
  await asOwner(db, `delete from public.profiles where id = '${OTHER}'`);
  assertEquals(await asOwner(db, 'select * from public.lists'), []);
});

Deno.test('admin check: is_app_admin() is true only for admins', async () => {
  const db = await setup();
  assertEquals((await asUser<{ a: boolean }>(db, ME, 'select public.is_app_admin() as a'))[0]!.a, true);
  assertEquals((await asUser<{ a: boolean }>(db, OTHER, 'select public.is_app_admin() as a'))[0]!.a, false);
});
