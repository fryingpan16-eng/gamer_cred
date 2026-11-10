/**
 * Migration 000043: comments on reviews.
 *   npm run test:sql -- review_comments
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER, setGuest, THIRD } from './_setup.ts';

/** OTHER's published review of game 1. */
async function setup(): Promise<{ db: PGlite; reviewId: string }> {
  const db = await freshDb();
  const r = await asOwner<{ id: string }>(
    db,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status)
     values ('${OTHER}', 1, ${numeric(80)}, 'Great game', 'published') returning id`,
  );
  return { db, reviewId: r[0]!.id };
}

const comment = async (db: PGlite, uid: string, reviewId: string, content: string) =>
  (await asUser<{ id: string }>(db, uid, 'insert into public.review_comments (user_id, review_id, content) values ($1, $2, $3) returning id', [uid, reviewId, content]))[0]!.id;

type PageRow = { id: string; user_id: string; content: string; edited_at: string | null; liked: boolean; like_count: number | null };
const page = (db: PGlite, uid: string, reviewId: string) =>
  asUser<PageRow>(db, uid, 'select * from public.review_comments_page($1)', [reviewId]);

Deno.test('members comment (the author too), oldest first; guests read only', async () => {
  const { db, reviewId } = await setup();
  await comment(db, ME, reviewId, '  Agreed!  ');
  await comment(db, OTHER, reviewId, '@myself thanks');
  const rows = await page(db, THIRD, reviewId);
  assertEquals(rows.map((r) => [r.user_id, r.content]), [[ME, 'Agreed!'], [OTHER, '@myself thanks']]);

  await setGuest(db, true);
  assertEquals((await page(db, THIRD, reviewId)).length, 2);
  await assertRejects(() => comment(db, THIRD, reviewId, 'hi'));
});

Deno.test('the filter, length rules, and no comments on drafts', async () => {
  const { db, reviewId } = await setup();
  await assertRejects(() => comment(db, ME, reviewId, 'you are a n1gger'), Error, 'keep it clean');
  await assertRejects(() => comment(db, ME, reviewId, '   '));
  await assertRejects(() => comment(db, ME, reviewId, 'x'.repeat(2001)));
  const id = await comment(db, ME, reviewId, 'fine');
  await assertRejects(() => asUser(db, ME, 'update public.review_comments set content = $1 where id = $2', ['shit take', id]), Error, 'keep it clean');

  await asOwner(db, `update public.reviews set status = 'draft' where id = '${reviewId}'`);
  await assertRejects(() => comment(db, ME, reviewId, 'hello'));
  assertEquals((await page(db, ME, reviewId)).length, 0);
});

Deno.test('only the writer edits (marked edited, ids/times kept); nobody deletes but admins via reports', async () => {
  const { db, reviewId } = await setup();
  const id = await comment(db, ME, reviewId, 'first');
  // Someone else's edit matches no rows.
  await asUser(db, THIRD, 'update public.review_comments set content = $1 where id = $2', ['hijack', id]);
  assertEquals((await page(db, ME, reviewId))[0]!.edited_at, null);

  await asUser(db, ME, `update public.review_comments set content = 'second', user_id = $1, created_at = now() - interval '9 days' where id = $2`, [THIRD, id]);
  const [row] = await asOwner<{ content: string; user_id: string; edited_at: string | null; created_at: string }>(
    db,
    `select content, user_id, edited_at, created_at from public.review_comments where id = '${id}'`,
  );
  assertEquals([row!.content, row!.user_id, row!.edited_at !== null], ['second', ME, true]);
  assertEquals(Date.now() - new Date(row!.created_at).getTime() < 60_000, true);

  await asUser(db, ME, 'delete from public.review_comments where id = $1', [id]);
  await asUser(db, OTHER, 'delete from public.review_comments where id = $1', [id]);
  assertEquals((await page(db, ME, reviewId)).length, 1);
});

Deno.test('60 comments an hour', async () => {
  const { db, reviewId } = await setup();
  for (let i = 0; i < 60; i++) await comment(db, ME, reviewId, `comment ${i}`);
  await assertRejects(() => comment(db, ME, reviewId, 'one more'), Error, 'a lot of comments');
  await comment(db, THIRD, reviewId, 'someone else still can');
});

Deno.test('blocked players: hidden from each other, and cannot comment on each other', async () => {
  const { db, reviewId } = await setup();
  await comment(db, ME, reviewId, 'from me');
  await comment(db, THIRD, reviewId, 'from third');
  await asUser(db, ME, 'select public.block_user($1)', [THIRD]);
  assertEquals((await page(db, ME, reviewId)).map((r) => r.user_id), [ME]);
  assertEquals((await asUser(db, ME, 'select * from public.review_comments')).length, 1);
  assertEquals((await page(db, THIRD, reviewId)).map((r) => r.user_id), [THIRD]);

  // The review's author blocks THIRD: no more comments from THIRD.
  await asUser(db, OTHER, 'select public.block_user($1)', [THIRD]);
  await assertRejects(() => comment(db, THIRD, reviewId, 'again'));
  assertEquals((await page(db, THIRD, reviewId)).length, 0);
});

Deno.test('comment likes are private; counts come with the review like info', async () => {
  const { db, reviewId } = await setup();
  const mine = await comment(db, ME, reviewId, 'mine');
  await comment(db, THIRD, reviewId, 'third');
  const like = (uid: string, id: string) =>
    asUser(db, uid, 'insert into public.review_comment_likes (user_id, comment_id) values ($1, $2)', [uid, id]);
  await like(OTHER, mine);
  await like(THIRD, mine);
  await assertRejects(() => like(ME, mine)); // your own

  const byMe = await page(db, ME, reviewId);
  assertEquals(byMe.map((r) => [r.liked, r.like_count]), [[false, 2], [false, null]]);
  const byOther = await page(db, OTHER, reviewId);
  assertEquals(byOther.map((r) => [r.liked, r.like_count]), [[true, null], [false, null]]);
  assertEquals((await asUser(db, ME, 'select * from public.review_comment_likes')).length, 0);

  type Info = { comment_count: number };
  const count = async (uid: string) => (await asUser<Info>(db, uid, 'select * from public.review_like_info($1)', [[reviewId]]))[0]!.comment_count;
  assertEquals(await count(OTHER), 2);
  await asUser(db, ME, 'select public.block_user($1)', [THIRD]);
  assertEquals(await count(ME), 1);
  await setGuest(db, true);
  assertEquals(await count(OTHER), 2);
});

Deno.test('reports: comment targets, admin queue preview + review link, removal', async () => {
  const { db, reviewId } = await setup();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`);
  const id = await comment(db, THIRD, reviewId, 'rude but allowed');
  // target_user_id is set from the comment, whatever the reporter sends.
  await asUser(
    db,
    OTHER,
    `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values ($1, 'comment', $2, $1, 'harassment')`,
    [OTHER, id],
  );
  type Report = { target_user_id: string; preview: string; context_id: string; content_exists: boolean };
  const [report] = await asUser<Report>(db, ME, 'select * from public.admin_reports()');
  assertEquals([report!.target_user_id, report!.preview, report!.context_id, report!.content_exists], [THIRD, 'rude but allowed', reviewId, true]);

  assertEquals((await asUser<{ n: number }>(db, ME, `select public.admin_resolve_reports('comment', $1, $2, true) as n`, [id, THIRD]))[0]!.n, 1);
  assertEquals((await page(db, ME, reviewId)).length, 0);
  await assertRejects(() => asUser(db, OTHER, `select public.admin_resolve_reports('comment', $1, $2, true)`, [id, THIRD]));
});

Deno.test('comments go with their review and their writer', async () => {
  const { db, reviewId } = await setup();
  await comment(db, ME, reviewId, 'a');
  await comment(db, THIRD, reviewId, 'b');
  await asOwner(db, `delete from public.profiles where id = '${THIRD}'`);
  assertEquals((await page(db, ME, reviewId)).length, 1);
  await asOwner(db, `delete from public.reviews where id = '${reviewId}'`);
  assertEquals((await asOwner(db, 'select * from public.review_comments')).length, 0);
});
