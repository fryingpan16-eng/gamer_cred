/**
 * Migration 000049: reviews can be marked as containing spoilers, and the
 * review browser and feeds return the flag.
 *   npm run test:sql -- spoiler_reviews
 */
import { assertEquals } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER } from './_setup.ts';

Deno.test('spoiler flag: off by default, the author sets it, browse and feed return it', async () => {
  const db = await freshDb();
  const [review] = await asUser<{ id: string; has_spoilers: boolean }>(
    db,
    OTHER,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status)
     values ($1, 1, ${numeric(80)}, 'The ending twist…', 'published') returning id, has_spoilers`,
    [OTHER],
  );
  assertEquals(review!.has_spoilers, false);
  await asUser(db, OTHER, 'update public.reviews set has_spoilers = true where id = $1', [review!.id]);

  const browse = await asUser<{ id: string; has_spoilers: boolean }>(
    db,
    ME,
    `select id, has_spoilers from public.game_reviews_browse(1, 'community', 'recent', 0, 20)`,
  );
  assertEquals(browse, [{ id: review!.id, has_spoilers: true }]);

  const feed = await asUser<{ review_id: string; has_spoilers: boolean }>(
    db,
    ME,
    `select review_id, has_spoilers from public.activity_feed('community', null, null, 20)`,
  );
  assertEquals(feed, [{ review_id: review!.id, has_spoilers: true }]);

  // Someone else can't flip it.
  await asUser(db, ME, 'update public.reviews set has_spoilers = false where id = $1', [review!.id]);
  const [saved] = await asOwner<{ has_spoilers: boolean }>(db, `select has_spoilers from public.reviews where id = '${review!.id}'`);
  assertEquals(saved!.has_spoilers, true);
});
