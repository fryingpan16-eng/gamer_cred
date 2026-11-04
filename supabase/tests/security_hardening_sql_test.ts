/**
 * Migration 000026: security hardening from the 2026-11-03 audit.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import samples from './fixtures/objectionable_samples.json' with { type: 'json' };
import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';

const filtered = async (db: PGlite, text: string) =>
  (await asOwner<{ v: boolean }>(db, `select public.contains_objectionable(${`'${text.replace(/'/g, "''")}'`}) as v`))[0]!.v;

Deno.test('database filter: blocks the shared "blocked" samples and allows the "allowed" ones', async () => {
  const db = await freshDb();
  for (const text of samples.blocked) assertEquals(await filtered(db, text), true, `should block: ${text}`);
  for (const text of samples.allowed) assertEquals(await filtered(db, text), false, `should allow: ${text}`);
  assertEquals(await filtered(db, ''), false);
});

Deno.test('objectionable usernames, list text, reviews, notes and devices are rejected; clean edits and old rows are fine', async () => {
  const db = await freshDb();
  await assertRejects(() => asUser(db, ME, `update public.profiles set username = 'big_fuck_99' where id = $1`, [ME]), Error, 'keep it clean');
  await asUser(db, ME, `update public.profiles set username = 'clean_name' where id = $1`, [ME]);

  await assertRejects(() => asUser(db, ME, `insert into public.lists (user_id, title) values ($1, 'shit list')`, [ME]), Error, 'keep it clean');
  await assertRejects(() => asUser(db, ME, `insert into public.lists (user_id, title, description) values ($1, 'Fine', 'you cunt')`, [ME]));
  await asUser(db, ME, `insert into public.lists (user_id, title) values ($1, 'Assassin''s Creed ranked')`, [ME]);

  await assertRejects(() =>
    asUser(db, ME, `insert into public.reviews (user_id, game_id, content, status) values ($1, 1, 'fucking awful', 'draft')`, [ME]),
  );
  await assertRejects(() => asOwner(db, `insert into public.now_playing (user_id, slot_index, game_id, notes) values ('${ME}', 1, 1, 'sh1t')`));
  await assertRejects(() => asOwner(db, `insert into public.user_platforms (user_id, platform_id, devices) values ('${ME}', 6, '{"bitch box"}')`));

  // A row that predates the filter can still be edited elsewhere.
  await asOwner(db, `alter table public.lists disable trigger lists_reject_objectionable`);
  await asOwner(db, `insert into public.lists (user_id, title, description) values ('${ME}', 'old shit', 'x')`);
  await asOwner(db, `alter table public.lists enable trigger lists_reject_objectionable`);
  await asUser(db, ME, `update public.lists set description = 'tidied' where title = 'old shit'`);
});

Deno.test('friend requests: the recipient cannot rewrite who sent it, and only pending requests change status', async () => {
  const db = await freshDb();
  const id = (
    await asUser<{ id: string }>(db, OTHER, `insert into public.friendships (user_id, friend_id) values ($1, $2) returning id`, [OTHER, ME])
  )[0]!.id;
  // Give ME the recipient's update right (the stub schema trims the real policies).
  await asOwner(
    db,
    `create policy "friendships: recipient responds" on public.friendships for update to authenticated
       using ((select auth.uid()) = friend_id) with check ((select auth.uid()) = friend_id)`,
  );

  await assertRejects(
    () => asUser(db, ME, `update public.friendships set user_id = $1, status = 'accepted' where id = $2`, [THIRD, id]),
    Error,
    "can't be changed",
  );
  await asUser(db, ME, `update public.friendships set status = 'accepted' where id = $1`, [id]);
  await assertRejects(() => asUser(db, ME, `update public.friendships set status = 'pending' where id = $1`, [id]), Error, "can't be changed");
});

Deno.test('reads need a session: signed-out requests see no profiles, lists or ratings', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.lists (user_id, title) values ($1, 'Public list')`, [ME]);
  const anon = async (sql: string) => {
    await db.exec(`reset role; select set_config('test.uid', '', false); set role anon;`);
    try {
      return (await db.query(sql)).rows;
    } finally {
      await db.exec('reset role;');
    }
  };
  await db.exec('grant usage on schema public to anon; grant select on all tables in schema public to anon;');
  assertEquals((await anon('select * from public.profiles')).length, 0);
  assertEquals((await anon('select * from public.lists')).length, 0);
  assertEquals((await anon('select * from public.game_ratings')).length, 0);
  // Signed in, they're visible.
  assertEquals((await asUser(db, OTHER, 'select * from public.lists')).length, 1);
});

Deno.test('rate limit: counts per user per window and refuses past the limit', async () => {
  const db = await freshDb();
  const take = async (uid: string) =>
    (await asOwner<{ ok: boolean }>(db, `select public.take_rate_limit('${uid}', 'igdb', 3, 3600) as ok`))[0]!.ok;
  assertEquals([await take(ME), await take(ME), await take(ME), await take(ME)], [true, true, true, false]);
  assertEquals(await take(OTHER), true); // per user
  // (The migration revokes it from app users; this harness re-grants every function afterwards, so that's checked live.)
});

Deno.test('sign-up names that fail the filter become neutral', async () => {
  const db = await freshDb();
  // Stand-ins for the real auth schema pieces handle_new_user uses.
  await db.exec(
    `reset role;
     create or replace function public.is_username_available(candidate text) returns boolean language sql stable
       as $$ select not exists (select 1 from public.profiles where lower(username) = lower(candidate)) $$;
     create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();`,
  );
  const signUp = async (id: string, meta: Record<string, string>, email = 'x@example.com') => {
    await asOwner(db, `insert into auth.users (id, email, raw_user_meta_data) values ('${id}', '${email}', '${JSON.stringify(meta)}')`);
    return (await asOwner<{ username: string }>(db, `select username from public.profiles where id = '${id}'`))[0]!.username;
  };
  assertEquals(await signUp('00000000-0000-0000-0000-0000000000d1', { username: 'nice_player' }), 'nice_player');
  const chosen = await signUp('00000000-0000-0000-0000-0000000000d2', { username: 'fuck_off' });
  assertEquals(/^[a-z0-9_]+_[0-9a-f]{4}$/.test(chosen) && !chosen.includes('fuck'), true);
  const google = await signUp('00000000-0000-0000-0000-0000000000d3', { full_name: 'Shit Head' });
  assertEquals(google.startsWith('player_'), true);
});
