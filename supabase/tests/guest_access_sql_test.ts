/**
 * Migration 000027: guests (anonymous sign-in) can read but never write, get no
 * profile, and are cleaned up after 30 days.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, setGuest } from './_setup.ts';

const GUEST = '00000000-0000-0000-0000-0000000000a9';

Deno.test('guests read what members read', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.lists (user_id, title) values ($1, 'Best RPGs')`, [ME]);
  await setGuest(db, true);
  assertEquals((await asUser(db, GUEST, 'select title from public.lists')).length, 1);
  assertEquals((await asUser(db, GUEST, 'select username from public.profiles')).length, 3);
});

Deno.test('guests cannot write anything, even rows that would be "theirs"', async () => {
  const db = await freshDb();
  await setGuest(db, true);
  await assertRejects(() => asUser(db, GUEST, `insert into public.lists (user_id, title) values ($1, 'Mine')`, [GUEST]));
  await assertRejects(() =>
    asUser(
      db,
      GUEST,
      `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ($1, 1, 90, 'numeric', '90')`,
      [GUEST],
    ),
  );
  await assertRejects(() => asUser(db, GUEST, `insert into public.friendships (user_id, friend_id) values ($1, $2)`, [GUEST, OTHER]));
  await assertRejects(() =>
    asUser(
      db,
      GUEST,
      `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values ($1, 'user', $2::text, $2::uuid, 'spam')`,
      [GUEST, OTHER],
    ),
  );
  // A member whose session is (somehow) marked anonymous is also read-only.
  const nameOf = async () =>
    (await asOwner<{ display_name: string | null }>(db, `select display_name from public.profiles where id = '${ME}'`))[0]!.display_name;
  await asUser(db, ME, `update public.profiles set display_name = 'Renamed' where id = $1`, [ME]); // filtered out: 0 rows
  assertEquals(await nameOf(), null);
  await setGuest(db, false);
  await asUser(db, ME, `update public.profiles set display_name = 'Renamed' where id = $1`, [ME]);
  assertEquals(await nameOf(), 'Renamed');
});

Deno.test('guest sign-ins get no profile; members still do', async () => {
  const db = await freshDb();
  await asOwner(db, `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()`);
  await db.exec(
    `create or replace function public.is_username_available(candidate text) returns boolean language sql stable
       as $$ select not exists (select 1 from public.profiles where lower(username) = lower(candidate)) $$;`,
  );
  await asOwner(db, `insert into auth.users (id, is_anonymous) values ('${GUEST}', true)`);
  await asOwner(db, `insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a8', 'a@b.c', '{"username":"newbie"}')`);
  const names = (await asOwner<{ username: string }>(db, 'select username from public.profiles order by username')).map((r) => r.username);
  assertEquals(names.includes('newbie'), true);
  assertEquals((await asOwner(db, `select 1 from public.profiles where id = '${GUEST}'`)).length, 0);
});

Deno.test('rate limits count guests (no profile needed) and old guests are purged', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into auth.users (id, is_anonymous, created_at) values ('${GUEST}', true, now() - interval '31 days')`);
  await asOwner(db, `insert into auth.users (id, is_anonymous) values ('00000000-0000-0000-0000-0000000000a7', true)`);
  assertEquals((await asOwner<{ ok: boolean }>(db, `select public.take_rate_limit('${GUEST}', 'igdb-guest', 30, 60) as ok`))[0]!.ok, true);

  assertEquals((await asOwner<{ n: number }>(db, 'select public.purge_old_guests() as n'))[0]!.n, 1);
  const left = await asOwner<{ id: string }>(db, 'select id from auth.users where is_anonymous');
  assertEquals(left.map((r) => r.id), ['00000000-0000-0000-0000-0000000000a7']);
  // Their counters go with them; members are untouched.
  assertEquals((await asOwner(db, `select 1 from public.api_rate_limits where user_id = '${GUEST}'`)).length, 0);
  assertEquals((await asOwner(db, `select 1 from auth.users where id = '${ME}'`)).length, 1);
});
