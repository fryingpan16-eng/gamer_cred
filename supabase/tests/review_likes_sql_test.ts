/**
 * Migration 000030: private review likes and the review browser.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER, setGuest, THIRD } from './_setup.ts';

const FOURTH = '00000000-0000-0000-0000-00000000000d';

/** Reviews of game 1 by ME (90), OTHER (70), THIRD (95), FOURTH (60), published a day apart (FOURTH newest). */
async function setup(): Promise<{ db: PGlite; ids: Record<string, string> }> {
  const db = await freshDb();
  await asOwner(db, `insert into auth.users (id) values ('${FOURTH}')`);
  await asOwner(db, `insert into public.profiles (id, username) values ('${FOURTH}', 'fourth')`);
  const ids: Record<string, string> = {};
  const rows: [string, number, number][] = [
    [ME, 90, 4],
    [OTHER, 70, 3],
    [THIRD, 95, 2],
    [FOURTH, 60, 1],
  ];
  for (const [uid, score, daysAgo] of rows) {
    const r = await asOwner<{ id: string }>(
      db,
      `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status, published_at)
       values ('${uid}', 1, ${numeric(score)}, 'text', 'published', now() - interval '${daysAgo} days') returning id`,
    );
    ids[uid] = r[0]!.id;
  }
  return { db, ids };
}

const browse = async (db: PGlite, uid: string, scope: string, sort: string) =>
  (await asUser<{ user_id: string }>(db, uid, 'select * from public.game_reviews_browse(1, $1, $2)', [scope, sort])).map((r) => r.user_id);

const likeReview = (db: PGlite, uid: string, reviewId: string) =>
  asUser(db, uid, 'insert into public.review_likes (user_id, review_id) values ($1, $2)', [uid, reviewId]);

Deno.test('sorts: recent, highest, lowest, and popular (by likes, then newest)', async () => {
  const { db, ids } = await setup();
  assertEquals(await browse(db, ME, 'community', 'recent'), [FOURTH, THIRD, OTHER, ME]);
  assertEquals(await browse(db, ME, 'community', 'highest'), [THIRD, ME, OTHER, FOURTH]);
  assertEquals(await browse(db, ME, 'community', 'lowest'), [FOURTH, OTHER, ME, THIRD]);
  await likeReview(db, ME, ids[OTHER]!);
  await likeReview(db, THIRD, ids[OTHER]!);
  await likeReview(db, OTHER, ids[ME]!);
  assertEquals(await browse(db, ME, 'community', 'popular'), [OTHER, ME, FOURTH, THIRD]);
  await assertRejects(() => browse(db, ME, 'community', 'nope'));
});

Deno.test('Friends tab: only accepted friends', async () => {
  const { db } = await setup();
  await asOwner(db, `insert into public.friendships (user_id, friend_id, status) values ('${ME}', '${OTHER}', 'accepted')`);
  await asOwner(db, `insert into public.friendships (user_id, friend_id, status) values ('${THIRD}', '${ME}', 'pending')`);
  assertEquals(await browse(db, ME, 'friends', 'recent'), [OTHER]);
});

Deno.test('likes are private: you see yours, authors see only their own counts; no self-likes; guests cannot like', async () => {
  const { db, ids } = await setup();
  await likeReview(db, OTHER, ids[ME]!);
  await likeReview(db, THIRD, ids[ME]!);
  await likeReview(db, ME, ids[OTHER]!);
  await assertRejects(() => likeReview(db, ME, ids[ME]!)); // your own review
  await assertRejects(() => likeReview(db, ME, ids[OTHER]!)); // twice

  // Nobody can read other people's likes.
  assertEquals((await asUser(db, FOURTH, 'select * from public.review_likes')).length, 0);
  assertEquals((await asUser(db, OTHER, 'select * from public.review_likes')).length, 1);

  type Info = { review_id: string; liked: boolean; like_count: number | null };
  const info = async (uid: string) =>
    Object.fromEntries(
      (await asUser<Info>(db, uid, 'select * from public.review_like_info($1)', [[ids[ME], ids[OTHER]]])).map((r) => [r.review_id, [r.liked, r.like_count]]),
    );
  // The author of ME's review sees its count; OTHER's count stays hidden from ME.
  assertEquals(await info(ME), { [ids[ME]!]: [false, 2], [ids[OTHER]!]: [true, null] });
  assertEquals(await info(THIRD), { [ids[ME]!]: [true, null], [ids[OTHER]!]: [false, null] });

  await setGuest(db, true);
  await assertRejects(() => likeReview(db, FOURTH, ids[THIRD]!));
});

Deno.test('drafts are never listed or likeable; blocked players are hidden', async () => {
  const { db, ids } = await setup();
  await asOwner(db, `update public.reviews set status = 'draft' where id = '${ids[THIRD]}'`);
  assertEquals((await browse(db, ME, 'community', 'recent')).includes(THIRD), false);
  await assertRejects(() => likeReview(db, ME, ids[THIRD]!));
  await asUser(db, ME, 'select public.block_user($1)', [FOURTH]);
  assertEquals((await browse(db, ME, 'community', 'recent')).includes(FOURTH), false);
});
