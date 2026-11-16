/**
 * Migration 000050: one app owner. Only the owner removes or demotes another
 * admin; nobody removes or demotes the owner.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, setAal, THIRD } from './_setup.ts';

/** ME = owner, OTHER = admin, THIRD = a player. The harness approves every admin's authenticator. */
async function setup(): Promise<PGlite> {
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id, is_owner) values ('${ME}', true), ('${OTHER}', false)`);
  return db;
}

const block = async (db: PGlite, caller: string, target: string) =>
  (await asOwner<{ v: string | null }>(db, `select public.admin_removal_block('${caller}', '${target}') as v`))[0]!.v;
const canDemote = async (db: PGlite, caller: string, target: string) =>
  (await asUser<{ v: boolean }>(db, caller, 'select public.admin_can_demote($1) as v', [target]))[0]!.v;
const admins = async (db: PGlite) =>
  (await asOwner<{ user_id: string }>(db, 'select user_id from public.app_admins order by user_id')).map((r) => r.user_id);

Deno.test('the migration makes a sole admin the owner, and stops when it cannot tell', async () => {
  const one = await freshDb({ through: 49 });
  await asOwner(one, `insert into public.app_admins (user_id) values ('${OTHER}')`);
  await one.exec(await Deno.readTextFile(new URL('../migrations/000050_app_owner.sql', import.meta.url)));
  assertEquals(await asOwner(one, 'select user_id from public.app_admins where is_owner'), [{ user_id: OTHER }]);

  const two = await freshDb({ through: 49 });
  await asOwner(two, `insert into public.app_admins (user_id) values ('${ME}'), ('${OTHER}')`);
  await assertRejects(
    async () => void (await two.exec(await Deno.readTextFile(new URL('../migrations/000050_app_owner.sql', import.meta.url)))),
    Error,
    'no owner',
  );
});

Deno.test('there is only ever one owner', async () => {
  const db = await setup();
  await assertRejects(() => asOwner(db, `update public.app_admins set is_owner = true where user_id = '${OTHER}'`));
});

Deno.test('account removal: admins never remove each other, the owner removes admins, nobody removes the owner', async () => {
  const db = await setup();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${THIRD}')`);
  assertEquals(await block(db, OTHER, THIRD), 'admin');
  assertEquals(await block(db, ME, THIRD), null);
  assertEquals(await block(db, OTHER, ME), 'owner');
  assertEquals(await block(db, ME, ME), 'owner');
  await asOwner(db, `delete from public.app_admins where user_id = '${THIRD}'`);
  assertEquals(await block(db, OTHER, THIRD), null); // an ordinary player
});

Deno.test('the owner demotes an admin: the role goes, the account stays, and it is logged', async () => {
  const db = await setup();
  assertEquals(await canDemote(db, ME, OTHER), true);
  await asUser(db, ME, 'select public.admin_demote($1)', [OTHER]);
  assertEquals(await admins(db), [ME]);
  assertEquals((await asOwner<{ n: number }>(db, `select count(*)::int as n from public.profiles where id = '${OTHER}'`))[0]!.n, 1);
  assertEquals((await asUser<{ v: boolean }>(db, OTHER, 'select public.is_app_admin() as v'))[0]!.v, false);
  assertEquals(
    await asOwner(db, `select admin_id, action, target_id from public.admin_actions`),
    [{ admin_id: ME, action: 'admin.demote', target_id: OTHER }],
  );
  assertEquals(await canDemote(db, ME, OTHER), false);
  await assertRejects(() => asUser(db, ME, 'select public.admin_demote($1)', [OTHER]), Error, 'isn’t an admin'.replace('’', "'"));
});

Deno.test('only the verified owner demotes; the owner is never demoted', async () => {
  const db = await setup();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${THIRD}')`);
  // another admin
  assertEquals(await canDemote(db, OTHER, THIRD), false);
  await assertRejects(() => asUser(db, OTHER, 'select public.admin_demote($1)', [THIRD]), Error, 'Only the app owner');
  await assertRejects(() => asUser(db, OTHER, 'select public.admin_demote($1)', [ME]), Error, 'Only the app owner');
  // the owner themselves
  assertEquals(await canDemote(db, ME, ME), false);
  await assertRejects(() => asUser(db, ME, 'select public.admin_demote($1)', [ME]), Error, 'can\'t be demoted');
  // the owner without two-step sign-in
  await setAal(db, 'aal1');
  assertEquals(await canDemote(db, ME, OTHER), false);
  await assertRejects(() => asUser(db, ME, 'select public.admin_demote($1)', [OTHER]), Error, 'Only the app owner');
  await setAal(db, 'aal2');
  assertEquals(await admins(db), [ME, OTHER, THIRD].sort());
});
