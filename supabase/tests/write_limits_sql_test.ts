/**
 * Migration 000047: hourly caps on new reviews, lists, reports and friend
 * requests; game_merges reads need a session.
 *   npm run test:sql -- write_limits
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER, THIRD } from './_setup.ts';

const publish = (gameId: number) =>
  `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status)
   values ('${ME}', ${gameId}, ${numeric(80)}, 'published')`;

Deno.test('30 new reviews an hour (replays included); edits are free', async () => {
  const db = await freshDb();
  for (let i = 0; i < 30; i++) await asUser(db, ME, publish(1));
  await assertRejects(() => asUser(db, ME, publish(2)), Error, 'a lot of reviews');
  // Editing an existing review isn't a new row.
  await asUser(db, ME, `update public.reviews set content = 'still fine' where user_id = '${ME}' and game_id = 1`);
  // Another player has their own budget.
  await asUser(db, OTHER, publish(1).replace(ME, OTHER));
});

Deno.test('service-role writes skip the cap', async () => {
  const db = await freshDb();
  for (let i = 0; i < 35; i++) await asOwner(db, publish(1));
  const [row] = await asOwner<{ n: number }>(db, `select count(*)::int as n from public.reviews where user_id = '${ME}'`);
  assertEquals(row!.n, 35);
});

Deno.test('20 new lists an hour', async () => {
  const db = await freshDb();
  const make = (i: number) => asUser(db, ME, `insert into public.lists (user_id, title) values ('${ME}', 'List ${i}')`);
  for (let i = 0; i < 20; i++) await make(i);
  await assertRejects(() => make(20), Error, 'a lot of lists');
});

Deno.test('friend requests are capped per hour', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.api_rate_limits (user_id, bucket, window_start, hits)
    values ('${ME}', 'friend_request', to_timestamp(floor(extract(epoch from now()) / 3600) * 3600), 60)`);
  await assertRejects(
    () => asUser(db, ME, `insert into public.friendships (user_id, friend_id) values ('${ME}', '${THIRD}')`),
    Error,
    'a lot of friend requests',
  );
});

Deno.test('game_merges: signed-in reads only', async () => {
  const db = await freshDb();
  const [policy] = await asOwner<{ roles: string[] }>(
    db,
    `select roles::text[] as roles from pg_policies where tablename = 'game_merges' and cmd = 'SELECT'`,
  );
  assertEquals(policy!.roles, ['authenticated']);
});

// 000048 follow-ups.
Deno.test('review_like_info skips reviews by blocked players', async () => {
  const db = await freshDb();
  const [review] = await asOwner<{ id: string }>(
    db,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status)
     values ('${OTHER}', 1, ${numeric(80)}, 'published') returning id`,
  );
  const info = () => asUser<{ review_id: string }>(db, ME, 'select * from public.review_like_info($1)', [[review!.id]]);
  assertEquals((await info()).length, 1);
  await asUser(db, OTHER, 'select public.block_user($1)', [ME]);
  assertEquals((await info()).length, 0);
});
