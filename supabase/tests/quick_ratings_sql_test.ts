/**
 * Migration 000015: quick ratings (public.game_ratings) on a real Postgres
 * (PGlite), with RLS applied as the `authenticated` role.
 *
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER } from './_setup.ts';

type RatingRow = { user_id: string; game_id: number; rating: number; rating_input_scale: string; rating_input: string };
type ReviewRow = { game_id: number; rating: number | null; rating_input: string | null; status: string };

/** What the app's rateGame() sends (upsert on the primary key). */
const rate = (db: PGlite, uid: string, gameId: number, score: number, scale = 'stars', input = '4') =>
  asUser(
    db,
    uid,
    `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input)
     values ($1, $2, $3, $4, $5)
     on conflict (user_id, game_id) do update
       set rating = excluded.rating, rating_input_scale = excluded.rating_input_scale, rating_input = excluded.rating_input`,
    [uid, gameId, score, scale, input],
  );
const clear = (db: PGlite, uid: string, gameId: number) =>
  asUser(db, uid, 'delete from public.game_ratings where user_id = $1 and game_id = $2', [uid, gameId]);
const myRatings = (db: PGlite, uid: string) =>
  asUser<RatingRow>(db, uid, 'select * from public.game_ratings order by game_id');
const reviewsOf = (db: PGlite, uid: string) =>
  asOwner<ReviewRow>(db, `select game_id, rating, rating_input, status from public.reviews where user_id = '${uid}' order by game_id`);

Deno.test('set, change and clear a quick rating', async () => {
  const db = await freshDb();
  await rate(db, ME, 10, 89, 'stars', '4');
  assertEquals((await myRatings(db, ME)).map((r) => [Number(r.game_id), r.rating, r.rating_input]), [[10, 89, '4']]);
  await rate(db, ME, 10, 95, 'stars', '4.5');
  assertEquals((await myRatings(db, ME)).map((r) => [Number(r.game_id), r.rating, r.rating_input]), [[10, 95, '4.5']]);
  await clear(db, ME, 10);
  assertEquals(await myRatings(db, ME), []);
});

Deno.test('one quick rating per game per user (primary key), and never a review', async () => {
  const db = await freshDb();
  await rate(db, ME, 10, 89);
  await assertRejects(() =>
    asUser(db, ME, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ($1, 10, 50, 'numeric', '50')`, [ME]),
  );
  assertEquals((await myRatings(db, ME)).length, 1);
  // Quick rating alone never creates, publishes or implies a review.
  assertEquals(await reviewsOf(db, ME), []);
});

Deno.test('RLS: quick ratings are private to their owner', async () => {
  const db = await freshDb();
  await rate(db, ME, 10, 89);
  assertEquals(await myRatings(db, OTHER), []); // can't read mine
  // can't write a rating as me
  await assertRejects(() => asUser(db, OTHER, `insert into public.game_ratings values ('${ME}', 11, 1, 'numeric', '1')`));
  // can't change or delete mine either (RLS filters the rows → 0 affected)
  await asUser(db, OTHER, `update public.game_ratings set rating = 1 where user_id = '${ME}'`);
  await asUser(db, OTHER, `delete from public.game_ratings where user_id = '${ME}'`);
  assertEquals((await myRatings(db, ME)).map((r) => r.rating), [89]);
  // signed out sees nothing
  assertEquals(await asUser(db, '', 'select * from public.game_ratings'), []);
});

Deno.test('backfill: existing rated reviews become quick ratings, untouched', async () => {
  const db = await freshDb({ through: 14 });
  await asOwner(db, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status) values
    ('${ME}', 1, ${numeric(77)}, 'published'), ('${ME}', 2, ${numeric(null)}, 'draft')`);
  await db.exec(await Deno.readTextFile(new URL('../migrations/000015_quick_ratings.sql', import.meta.url)));
  assertEquals((await asOwner<RatingRow>(db, 'select * from public.game_ratings')).map((r) => [Number(r.game_id), r.rating]), [[1, 77]]);
  assertEquals((await reviewsOf(db, ME)).map((r) => [Number(r.game_id), r.rating, r.status]), [[1, 77, 'published'], [2, null, 'draft']]);
});

Deno.test('one score per game: a review score sets the quick rating, and a quick rating change updates the review', async () => {
  const db = await freshDb();
  // review first (as saveReview does)
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content) values ($1, 1, 92, 'tier', 'A+', 'great')`, [ME]);
  assertEquals((await myRatings(db, ME)).map((r) => [r.rating, r.rating_input_scale, r.rating_input]), [[92, 'tier', 'A+']]);
  // then a quick rating change
  await rate(db, ME, 1, 79, 'stars', '3.5');
  assertEquals((await reviewsOf(db, ME)).map((r) => [r.rating, r.rating_input]), [[79, '3.5']]);
  // and the review is still the same review (content untouched)
  assertEquals((await asOwner<{ content: string }>(db, 'select content from public.reviews'))[0]!.content, 'great');
});

Deno.test('clearing: blocked while a published review needs the score; clears a draft score with it', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, status) values
    ($1, 1, 90, 'numeric', '90', 'published'), ($1, 2, 60, 'numeric', '60', 'draft')`, [ME]);
  await assertRejects(() => clear(db, ME, 1), Error, 'published review');
  assertEquals((await myRatings(db, ME)).map((r) => Number(r.game_id)), [1, 2]);
  await clear(db, ME, 2);
  assertEquals((await reviewsOf(db, ME)).map((r) => [Number(r.game_id), r.rating, r.status]), [[1, 90, 'published'], [2, null, 'draft']]);
});

Deno.test('deleting a review keeps the quick rating; deleting the account removes everything', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input) values ($1, 1, 90, 'numeric', '90')`, [ME]);
  await asUser(db, ME, 'delete from public.reviews where user_id = $1', [ME]);
  assertEquals((await myRatings(db, ME)).map((r) => r.rating), [90]);
  // account deletion cascades even with a published review (trigger skips cascades)
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input) values ($1, 1, 90, 'numeric', '90')`, [ME]);
  await asOwner(db, `delete from public.profiles where id = '${ME}'`);
  assertEquals(await asOwner(db, 'select * from public.game_ratings'), []);
  assertEquals(await asOwner(db, 'select * from public.reviews'), []);
});

Deno.test('Gamer Cred score counts one score per user from reviews and quick ratings', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input) values ($1, 1, 90, 'numeric', '90')`, [ME]);
  await rate(db, OTHER, 1, 70, 'stars', '3');
  // My review + my (synced) quick rating count once; OTHER's private quick rating counts too.
  const [stats] = await asUser<{ review_count: number; average_rating: string; distribution: number[] }>(
    db,
    OTHER,
    'select * from public.game_review_stats(1)',
  );
  assertEquals(stats!.review_count, 2);
  assertEquals(Number(stats!.average_rating), 80);
  assertEquals(stats!.distribution[89], 1); // score 90
  // ...but OTHER still can't read my individual rating.
  assertEquals((await myRatings(db, OTHER)).map((r) => r.user_id), [OTHER]);
});

Deno.test('stats: quick-rated games count as logged (platform Unknown) and in the score stats', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, platform_id) values ($1, 1, 90, 'numeric', '90', 6)`, [ME]);
  await rate(db, ME, 2, 40, 'stars', '2');
  const logged = await asUser<{ game_id: number; rating: number; platform_id: number | null }>(db, ME, 'select * from public.my_logged_games() order by game_id');
  assertEquals(logged.map((l) => [Number(l.game_id), l.rating, l.platform_id === null ? null : Number(l.platform_id)]), [[1, 90, 6], [2, 40, null]]);
  const hist = await asUser<{ score: number; games: number }>(db, ME, 'select * from public.stats_rating_histogram()');
  assertEquals(hist.map((h) => [h.score, h.games]), [[40, 1], [90, 1]]);
  const platforms = await asUser<{ platform_id: number | null; games: number }>(db, ME, 'select * from public.stats_platforms()');
  assertEquals(platforms.map((p) => [p.platform_id === null ? null : Number(p.platform_id), p.games]), [[6, 1], [null, 1]]);
});
