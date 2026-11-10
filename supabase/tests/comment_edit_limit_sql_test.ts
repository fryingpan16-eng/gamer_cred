/**
 * Migration 000046: comment edits are limited to 30 an hour.
 *   npm run test:sql -- comment_edit_limit
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER } from './_setup.ts';

Deno.test('30 comment edits an hour; unchanged saves are free', async () => {
  const db = await freshDb();
  const [review] = await asOwner<{ id: string }>(
    db,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status)
     values ('${OTHER}', 1, ${numeric(80)}, 'Great game', 'published') returning id`,
  );
  const [row] = await asUser<{ id: string }>(
    db,
    ME,
    'insert into public.review_comments (user_id, review_id, content) values ($1, $2, $3) returning id',
    [ME, review!.id, 'start'],
  );
  const edit = (content: string) => asUser(db, ME, 'update public.review_comments set content = $1 where id = $2', [content, row!.id]);

  for (let i = 0; i < 30; i++) await edit(`edit ${i}`);
  // Same text again changes nothing, so it doesn't count.
  await edit('edit 29');
  await assertRejects(() => edit('one more'), Error, 'edited a lot of comments');

  const [saved] = await asOwner<{ content: string }>(db, `select content from public.review_comments where id = '${row!.id}'`);
  assertEquals(saved!.content, 'edit 29');
});
