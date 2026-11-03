/**
 * Migration 000025: admin powers need a two-step-verified session (aal2), and
 * admin actions land in an append-only activity log.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, setAal, THIRD } from './_setup.ts';

async function setup(): Promise<PGlite> {
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`);
  return db;
}

const newList = async (db: PGlite, uid: string, title = 'A list') =>
  (await asUser<{ id: string }>(db, uid, `insert into public.lists (user_id, title) values ($1, $2) returning id`, [uid, title]))[0]!.id;

type Activity = { action: string; target_type: string; target_id: string; admin_name: string; details: Record<string, unknown> };
const activity = async (db: PGlite) => asUser<Activity>(db, ME, 'select * from public.admin_activity(50)');

Deno.test('without a verified (aal2) session an admin has no admin powers', async () => {
  const db = await setup();
  const list = await newList(db, OTHER);
  await setAal(db, 'aal1');

  assertEquals((await asUser<{ v: boolean }>(db, ME, 'select public.is_app_admin() as v'))[0]!.v, false);
  assertEquals((await asUser<{ v: boolean }>(db, ME, 'select public.is_app_admin_member() as v'))[0]!.v, true);
  await assertRejects(() => asUser(db, ME, 'select public.set_list_pin($1, 1::smallint)', [list]), Error, 'Only app admins');
  await assertRejects(() => asUser(db, ME, `insert into public.lists (user_id, title, smart_rule) values ($1, 'S', '{}')`, [ME]));
  await assertRejects(() => asUser(db, ME, 'select * from public.admin_reports()'));
  await assertRejects(() => asUser(db, ME, 'select * from public.admin_activity()'));

  await setAal(db, 'aal2');
  assertEquals((await asUser<{ v: boolean }>(db, ME, 'select public.is_app_admin() as v'))[0]!.v, true);
  await asUser(db, ME, 'select public.set_list_pin($1, 1::smallint)', [list]);
});

Deno.test('non-admins are never admins, verified or not', async () => {
  const db = await setup();
  assertEquals((await asUser<{ v: boolean }>(db, OTHER, 'select public.is_app_admin() as v'))[0]!.v, false);
  assertEquals((await asUser<{ v: boolean }>(db, OTHER, 'select public.is_app_admin_member() as v'))[0]!.v, false);
});

Deno.test('featuring, smart rules and report decisions are logged with the admin name', async () => {
  const db = await setup();
  const list = await newList(db, OTHER, 'Couch co-op');
  await asUser(db, ME, 'select public.set_list_pin($1, 2::smallint)', [list]);
  await asUser(db, ME, 'select public.set_list_pin($1, null)', [list]);
  await asUser(db, ME, `insert into public.lists (user_id, title, smart_rule) values ($1, 'Top 500', '{"entryTypes":["game"]}')`, [ME]);
  await asUser(
    db,
    THIRD,
    `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values ($1, 'list', $2::text, $3, 'spam')`,
    [THIRD, list, OTHER],
  );
  await asUser(db, ME, `select public.admin_resolve_reports('list', $1, $2, false, 'fine')`, [list, OTHER]);

  const log = await activity(db);
  assertEquals(
    log.map((a) => a.action),
    ['reports.dismiss', 'list.smart_rule', 'list.unfeature', 'list.feature'],
  );
  assertEquals(log[3]!.details.title, 'Couch co-op');
  assertEquals(log[3]!.details.rank, 2);
  assertEquals(log[0]!.details.reports, 1);
  assertEquals(log.every((a) => a.admin_name === 'me'), true);
});

Deno.test('the log is read-only: no one can write, edit or delete entries directly', async () => {
  const db = await setup();
  const list = await newList(db, OTHER);
  await asUser(db, ME, 'select public.set_list_pin($1, 1::smallint)', [list]);

  await assertRejects(() => asUser(db, ME, `insert into public.admin_actions (admin_id, action) values ($1, 'fake')`, [ME]));
  await asUser(db, ME, `update public.admin_actions set action = 'edited'`);
  await asUser(db, ME, 'delete from public.admin_actions');
  assertEquals((await activity(db)).map((a) => a.action), ['list.feature']);

  // Others can't read it, and their log calls do nothing.
  assertEquals((await asUser(db, OTHER, 'select * from public.admin_actions')).length, 0);
  await asUser(db, OTHER, `select public.log_admin_action('forged', null, null)`);
  assertEquals((await activity(db)).length, 1);
});
