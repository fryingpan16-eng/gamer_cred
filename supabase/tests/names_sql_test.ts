/**
 * Migrations 000038–000039: permanent names, display names, name rules, official badge.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals, assertRejects } from '@std/assert';
import type { PGlite } from '@electric-sql/pglite';

import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';


/** Owner sets a player_ name the app hasn't chosen yet. */
async function unchosen(db: PGlite, uid: string) {
  await asOwner(db, `update public.profiles set username = 'player_ab12cd' where id = '${uid}'`);
  await asOwner(db, `update public.profiles set username_chosen = false where id = '${uid}'`);
}

const samples = JSON.parse(await Deno.readTextFile(new URL('./fixtures/name_samples.json', import.meta.url))) as {
  permanentFormat: { ok: string[]; bad: string[] };
  displayFormat: { ok: string[]; bad: string[] };
  blocked: string[];
  allowed: string[];
};

async function problem(db: PGlite, kind: 'permanent' | 'display', name: string, uid = ME) {
  const [row] = await asUser<{ p: string | null }>(db, uid, 'select public.check_name($1, $2) as p', [kind, name]);
  return row!.p;
}

Deno.test('permanent name format: A–Z, numbers and keyboard symbols, no spaces or @', async () => {
  const db = await freshDb();
  for (const name of samples.permanentFormat.ok) assertEquals(await problem(db, 'permanent', name), null, name);
  for (const name of samples.permanentFormat.bad) assertEquals(await problem(db, 'permanent', name), 'format', name);
});

Deno.test('display name format: any alphabet, spaces and keyboard symbols; no emoji, @ or control characters', async () => {
  const db = await freshDb();
  for (const name of samples.displayFormat.ok) assertEquals(await problem(db, 'display', name), null, name);
  for (const name of samples.displayFormat.bad) assertEquals(await problem(db, 'display', name), 'format', name);
});

Deno.test('slurs, profanity, staff and reserved names are blocked on both names; everyday names are not', async () => {
  const db = await freshDb();
  for (const name of samples.blocked) {
    const display = await problem(db, 'display', name);
    assertEquals(display === 'language' || display === 'reserved', true, `display "${name}" → ${display}`);
    const permanent = name.replace(/ /g, '');
    if (permanent.length >= 3 && permanent.length <= 24 && /^[\x21-\x7e]+$/.test(permanent) && !permanent.includes('@')) {
      const p = await problem(db, 'permanent', permanent);
      assertEquals(p === 'language' || p === 'reserved', true, `permanent "${permanent}" → ${p}`);
    }
  }
  for (const name of samples.allowed) {
    assertEquals(await problem(db, 'display', name), null, `display "${name}"`);
    const permanent = name.replace(/ /g, '');
    if (permanent.length >= 3 && permanent.length <= 24 && /^[\x21-\x7e]+$/.test(permanent)) {
      assertEquals(await problem(db, 'permanent', permanent), null, `permanent "${permanent}"`);
    }
  }
});

Deno.test('permanent names: taken ignores capitals; look-alikes are too close; your own name is fine', async () => {
  const db = await freshDb();
  await asOwner(db, `update public.profiles set username = 'Gordon_l' where id = '${OTHER}'`);
  assertEquals(await problem(db, 'permanent', 'GORDON_L'), 'taken');
  assertEquals(await problem(db, 'permanent', 'Gordon_I'), 'too_close');
  assertEquals(await problem(db, 'permanent', 'G.o.r.d.o.n.1'), 'too_close');
  assertEquals(await problem(db, 'permanent', 'Gordon_l', OTHER), null);
  assertEquals(await problem(db, 'permanent', 'Gordon_li'), null);
});

Deno.test('permanent name is locked once chosen; player_ accounts choose it once', async () => {
  const db = await freshDb();
  await assertRejects(
    () => asUser(db, ME, `update public.profiles set username = 'new_name' where id = $1`, [ME]),
    Error,
    'can\'t be changed',
  );
  await unchosen(db, ME);
  await asUser(db, ME, `update public.profiles set username = 'Picked_Name' where id = $1`, [ME]);
  const [row] = await asOwner<{ username: string; username_chosen: boolean }>(db, `select username, username_chosen from public.profiles where id = '${ME}'`);
  assertEquals(row, { username: 'Picked_Name', username_chosen: true });
  await assertRejects(() => asUser(db, ME, `update public.profiles set username = 'Again' where id = $1`, [ME]), Error, 'can\'t be changed');
  // The app can't unlock it either.
  await asUser(db, ME, `update public.profiles set username_chosen = false where id = $1`, [ME]);
  const [after] = await asOwner<{ username_chosen: boolean }>(db, `select username_chosen from public.profiles where id = '${ME}'`);
  assertEquals(after!.username_chosen, true);
});

Deno.test('choosing a permanent name runs every rule', async () => {
  const db = await freshDb();
  await unchosen(db, ME);
  await assertRejects(() => asUser(db, ME, `update public.profiles set username = 'Chinkdude' where id = $1`, [ME]), Error, 'keep it clean');
  await assertRejects(() => asUser(db, ME, `update public.profiles set username = 'TheRealHideoKojima' where id = $1`, [ME]), Error, 'reserved');
  await assertRejects(() => asUser(db, ME, `update public.profiles set username = 'OTHER' where id = $1`, [ME]), Error, 'taken');
  await asUser(db, ME, `update public.profiles set username = 'Canadiandude' where id = $1`, [ME]);
});

Deno.test('display name: once a day, server-stamped, normalised; the app cannot reset the clock', async () => {
  const db = await freshDb();
  await asUser(db, ME, `update public.profiles set display_name = 'Café Gamer' where id = $1`, [ME]);
  await assertRejects(
    () => asUser(db, ME, `update public.profiles set display_name = 'Another' where id = $1`, [ME]),
    Error,
    'once a day',
  );
  await asUser(db, ME, `update public.profiles set display_name_changed_at = null where id = $1`, [ME]);
  await assertRejects(() => asUser(db, ME, `update public.profiles set display_name = 'Another' where id = $1`, [ME]), Error, 'once a day');
  await asOwner(db, `update public.profiles set display_name_changed_at = now() - interval '25 hours' where id = '${ME}'`);
  await asUser(db, ME, `update public.profiles set display_name = 'Another' where id = $1`, [ME]);
  // Decomposed é is stored composed.
  await asOwner(db, `update public.profiles set display_name_changed_at = null where id = '${OTHER}'`);
  await asUser(db, OTHER, `update public.profiles set display_name = $2 where id = $1`, [OTHER, 'Café']);
  const [row] = await asOwner<{ display_name: string }>(db, `select display_name from public.profiles where id = '${OTHER}'`);
  assertEquals(row!.display_name, 'Café');
  await assertRejects(
    () => asUser(db, THIRD, `update public.profiles set display_name = 'Taylor Swift' where id = $1`, [THIRD]),
    Error,
    'reserved',
  );
});

Deno.test('sign-up: a good requested name is kept and locked; a bad one becomes player_ to choose later', async () => {
  const db = await freshDb();
  await asOwner(db, `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()`);
  const ids = ['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3'];
  await asOwner(db, `insert into auth.users (id, raw_user_meta_data) values
    ('${ids[0]}', '{"username":"Fresh_Player"}'), ('${ids[1]}', '{"username":"Hideo Kojima"}'), ('${ids[2]}', '{"full_name":"Real Person"}')`);
  const rows = await asOwner<{ id: string; username: string; username_chosen: boolean }>(
    db,
    `select id, username, username_chosen from public.profiles where id in ('${ids.join("','")}') order by id`,
  );
  assertEquals(rows[0], { id: ids[0], username: 'Fresh_Player', username_chosen: true });
  assertEquals(/^player_[0-9a-f]{6}$/.test(rows[1]!.username) && !rows[1]!.username_chosen, true);
  assertEquals(/^player_[0-9a-f]{6}$/.test(rows[2]!.username) && !rows[2]!.username_chosen, true);
});

Deno.test('official badge: only admins with an approved authenticator; names come back in one call', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${OTHER}')`);
  await asOwner(db, `insert into public.app_admins (user_id, mfa_factor_id) values ('${THIRD}', gen_random_uuid())`); // not a real factor
  const rows = await asUser<{ id: string; username: string; is_official: boolean }>(
    db,
    ME,
    `select id, username, is_official from public.profile_names($1) order by username`,
    [[ME, OTHER, THIRD]],
  );
  assertEquals(rows.map((r) => [r.username, r.is_official]), [['myself', false], ['other', true], ['third', false]]);
});

Deno.test('admin reset: clears the display name, restarts the limit, is logged; members cannot', async () => {
  const db = await freshDb();
  await asUser(db, ME, `update public.profiles set display_name = 'Loud Name' where id = $1`, [ME]);
  await assertRejects(() => asUser(db, THIRD, `select public.admin_reset_display_name($1)`, [ME]), Error, 'Only app admins');
  await asOwner(db, `insert into public.app_admins (user_id) values ('${OTHER}')`);
  await asUser(db, OTHER, `select public.admin_reset_display_name($1)`, [ME]);
  const [row] = await asOwner<{ display_name: string | null; display_name_changed_at: string | null }>(
    db,
    `select display_name, display_name_changed_at from public.profiles where id = '${ME}'`,
  );
  assertEquals(row, { display_name: null, display_name_changed_at: null });
  const [log] = await asOwner<{ action: string; details: { display_name: string } }>(db, `select action, details from public.admin_actions`);
  assertEquals(log, { action: 'user.reset_display_name', details: { display_name: 'Loud Name' } });
  await asUser(db, ME, `update public.profiles set display_name = 'Quiet Name' where id = $1`, [ME]);
});

Deno.test('a reserved name can be released for one account', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into private.name_exceptions (user_id, name_key) values ('${ME}', private.name_key('Hideo Kojima'))`);
  assertEquals(await problem(db, 'display', 'Hideo Kojima', ME), null);
  assertEquals(await problem(db, 'display', 'Hideo Kojima', OTHER), 'reserved');
});

Deno.test('the rule tables are not readable by players', async () => {
  const db = await freshDb();
  await assertRejects(() => asUser(db, ME, 'select * from private.name_blocklist limit 1'), Error, 'permission denied');
});
