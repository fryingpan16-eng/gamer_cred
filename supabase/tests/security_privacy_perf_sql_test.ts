/**
 * Migration 000036: picture guard on insert, blocks hide friendships,
 * server-owned timestamps, stored like counts.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER, THIRD } from './_setup.ts';

Deno.test('profiles: members cannot insert a profile row, and no insert can carry a picture', async () => {
  const db = await freshDb();
  const NEW = '00000000-0000-0000-0000-00000000000d';
  await asOwner(db, `insert into auth.users (id) values ('${NEW}')`);
  await assertRejects(() =>
    asUser(db, NEW, `insert into public.profiles (id, username, avatar_url) values ($1, 'sneaky', 'https://example.com/x.jpg')`, [NEW]),
  );
  await assertRejects(() => asUser(db, NEW, `insert into public.profiles (id, username) values ($1, 'sneaky')`, [NEW]));
});

Deno.test("friendships: a blocked player can't see the blocker's friends", async () => {
  const db = await freshDb();
  // THIRD is friends with OTHER; ME blocks... THIRD blocks ME, so ME must not see THIRD's friendships.
  await asOwner(db, `insert into public.friendships (user_id, friend_id, status) values ('${OTHER}', '${THIRD}', 'accepted')`);
  const visible = async () =>
    (await asUser<{ n: number }>(db, ME, `select count(*)::int as n from public.friendships where $1 in (user_id, friend_id)`, [THIRD]))[0]!.n;
  assertEquals(await visible(), 1);
  await asUser(db, THIRD, `select public.block_user('${ME}')`);
  assertEquals(await visible(), 0);
  // OTHER (not involved) still sees it.
  assertEquals(
    (await asUser<{ n: number }>(db, OTHER, `select count(*)::int as n from public.friendships where $1 in (user_id, friend_id)`, [THIRD]))[0]!.n,
    1,
  );
});

Deno.test('reviews: published_at and created_at are set by the server, never by the client', async () => {
  const db = await freshDb();
  await asUser(
    db,
    ME,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status, created_at, published_at)
     values ($1, 1, ${numeric(80)}, 'Hi', 'published', '2099-01-01', '2099-01-01')`,
    [ME],
  );
  const read = async () =>
    (await asOwner<{ future: boolean; created_future: boolean }>(
      db,
      `select published_at > now() + interval '1 day' as future, created_at > now() + interval '1 day' as created_future from public.reviews`,
    ))[0]!;
  assertEquals(await read(), { future: false, created_future: false });
  await asUser(db, ME, `update public.reviews set published_at = '2099-01-01', created_at = '2099-01-01', content = 'Edited' where user_id = $1`, [ME]);
  assertEquals(await read(), { future: false, created_future: false });
});

Deno.test('game_ratings / now_playing / game_likes: insert times are stamped by the server', async () => {
  const db = await freshDb();
  await asUser(
    db,
    ME,
    `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, created_at, updated_at)
     values ($1, 1, 80, 'numeric', '80', '2099-01-01', '2099-01-01')`,
    [ME],
  );
  await asUser(db, ME, `insert into public.game_likes (user_id, game_id, created_at) values ($1, 1, '2099-01-01')`, [ME]);
  const [r] = await asOwner<{ a: boolean; b: boolean; c: boolean }>(
    db,
    `select (select created_at < now() + interval '1 day' and updated_at < now() + interval '1 day' from public.game_ratings) as a,
            (select created_at < now() + interval '1 day' from public.game_likes) as b,
            true as c`,
  );
  assertEquals(r, { a: true, b: true, c: true });
});

Deno.test('review like counts follow likes and unlikes (Popular sort)', async () => {
  const db = await freshDb();
  for (const uid of [ME, OTHER]) {
    await asUser(
      db,
      uid,
      `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ($1, 7, ${numeric(70)}, 'x', 'published')`,
      [uid],
    );
  }
  const reviewOf = async (uid: string) => (await asOwner<{ id: string }>(db, `select id from public.reviews where user_id = '${uid}'`))[0]!.id;
  const meReview = await reviewOf(ME);
  await asUser(db, OTHER, `insert into public.review_likes (user_id, review_id) values ($1, $2)`, [OTHER, meReview]);
  await asUser(db, THIRD, `insert into public.review_likes (user_id, review_id) values ($1, $2)`, [THIRD, meReview]);
  const count = async () =>
    (await asOwner<{ likes: number }>(db, `select likes from private.review_like_counts where review_id = '${meReview}'`))[0]?.likes;
  assertEquals(await count(), 2);
  const popular = async () =>
    (await asUser<{ user_id: string }>(db, THIRD, `select user_id from public.game_reviews_browse(7, 'community', 'popular')`)).map((r) => r.user_id);
  assertEquals((await popular())[0], ME);
  await asUser(db, OTHER, `delete from public.review_likes where review_id = $1`, [meReview]);
  await asUser(db, THIRD, `delete from public.review_likes where review_id = $1`, [meReview]);
  assertEquals(await count(), 0);
  // Members can't read the counts table directly.
  await assertRejects(() => asUser(db, ME, `select * from private.review_like_counts`));
  // Deleting the review drops its count row.
  await asUser(db, ME, `delete from public.reviews where id = $1`, [meReview]);
  assertEquals(await count(), undefined);
});

Deno.test('activity_feed: community + friends review branches, keyset paging (000036 rewrite)', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.friendships (user_id, friend_id, status) values ('${ME}', '${OTHER}', 'accepted')`);
  for (const [uid, game] of [[OTHER, 1], [THIRD, 2], [OTHER, 3]] as const) {
    await asUser(
      db,
      uid,
      `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ($1, ${game}, ${numeric(60)}, 'r${game}', 'published')`,
      [uid],
    );
  }
  type Row = { item_key: string; occurred_at: string; game_id: number };
  const community = await asUser<Row>(db, ME, `select * from public.activity_feed('community', null, null, 20)`);
  assertEquals(community.map((r) => Number(r.game_id)), [3, 2, 1]);
  const friends = await asUser<Row>(db, ME, `select * from public.activity_feed('friends', null, null, 20)`);
  assertEquals(friends.map((r) => Number(r.game_id)), [3, 1]);
  // Page 2 starts after the first item's cursor.
  const first = community[0]!;
  const next = await asUser<Row>(db, ME, `select * from public.activity_feed('community', $1, $2, 20)`, [first.occurred_at, first.item_key]);
  assertEquals(next.map((r) => Number(r.game_id)), [2, 1]);
});
