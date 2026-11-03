/**
 * Migration 000021: blocking, reporting + moderation, terms acceptance.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';

async function setup(): Promise<PGlite> {
  const db = await freshDb();
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`); // ME moderates
  // OTHER has public content of every kind; THIRD is a bystander.
  await db.exec(`reset role;
    insert into public.friendships (user_id, friend_id, status) values ('${OTHER}', '${THIRD}', 'accepted');
    insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ('${OTHER}', 1, 30, 'numeric', '30', 'rude review', 'published');
    insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ('${OTHER}', 2, 10, 'numeric', '10') on conflict do nothing;
    insert into public.lists (user_id, title) values ('${OTHER}', 'Other''s list');
    insert into public.now_playing values ('${OTHER}', 1, 5);
    insert into public.user_favorites values ('${OTHER}', 1, 6);
    insert into public.user_platforms values ('${OTHER}', 167);`);
  return db;
}

const visibleTo = async (db: PGlite, uid: string) => ({
  profiles: (await asUser<{ username: string }>(db, uid, 'select username from public.profiles order by username')).map((r) => r.username),
  reviews: (await asUser(db, uid, `select 1 from public.reviews where user_id = '${OTHER}'`)).length,
  ratings: (await asUser(db, uid, `select 1 from public.game_ratings where user_id = '${OTHER}'`)).length,
  lists: (await asUser(db, uid, `select 1 from public.lists where user_id = '${OTHER}'`)).length,
  nowPlaying: (await asUser(db, uid, `select 1 from public.now_playing where user_id = '${OTHER}'`)).length,
  favorites: (await asUser(db, uid, `select 1 from public.user_favorites where user_id = '${OTHER}'`)).length,
  platforms: (await asUser(db, uid, `select 1 from public.user_platforms where user_id = '${OTHER}'`)).length,
});

Deno.test('blocking hides both users from each other everywhere; others unaffected; unblock restores', async () => {
  const db = await setup();
  await asUser(db, THIRD, `select public.block_user('${OTHER}')`);
  const hidden = { profiles: ['me', 'third'], reviews: 0, ratings: 0, lists: 0, nowPlaying: 0, favorites: 0, platforms: 0 };
  assertEquals(await visibleTo(db, THIRD), hidden);
  // ...and the blocked user can't see the blocker either
  const otherSees = (await asUser<{ username: string }>(db, OTHER, 'select username from public.profiles order by username')).map((r) => r.username);
  assertEquals(otherSees, ['me', 'other']);
  // a bystander still sees everything
  assertEquals(await visibleTo(db, ME), { profiles: ['me', 'other', 'third'], reviews: 1, ratings: 2, // the review's score is a rating too
   lists: 1, nowPlaying: 1, favorites: 1, platforms: 1 });
  // the block shows in the blocker's list (even though the profile is hidden), not the blocked user's
  assertEquals((await asUser<{ username: string }>(db, THIRD, 'select * from public.my_blocked_users()')).map((r) => r.username), ['other']);
  assertEquals((await asUser(db, OTHER, 'select * from public.user_blocks')).length, 0);
  assertEquals((await asUser<{ s: string }>(db, THIRD, `select public.block_state('${OTHER}') as s`))[0]!.s, 'blocked_by_me');
  assertEquals((await asUser<{ s: string }>(db, OTHER, `select public.block_state('${THIRD}') as s`))[0]!.s, 'blocked_me');
  await asUser(db, THIRD, `select public.unblock_user('${OTHER}')`);
  assertEquals((await visibleTo(db, THIRD)).reviews, 1);
});

Deno.test('blocking removes the friendship and stops new friend requests both ways', async () => {
  const db = await setup();
  await asUser(db, THIRD, `select public.block_user('${OTHER}')`);
  assertEquals(await asOwner(db, 'select * from public.friendships'), []);
  await assertRejects(() => asUser(db, OTHER, `insert into public.friendships (user_id, friend_id) values ($1, $2)`, [OTHER, THIRD]), Error, "can't send");
  await assertRejects(() => asUser(db, THIRD, `insert into public.friendships (user_id, friend_id) values ($1, $2)`, [THIRD, OTHER]), Error, "can't send");
  await assertRejects(() => asUser(db, THIRD, `select public.block_user('${THIRD}')`), Error, 'yourself');
});

Deno.test('reports: anyone reports, only sees their own, one open report per item', async () => {
  const db = await setup();
  const report = (uid: string) =>
    asUser(db, uid, `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason, details)
                     values ($1, 'user', $2::text, $2::uuid, 'harassment', 'mean')`, [uid, OTHER]);
  await report(THIRD);
  await assertRejects(() => report(THIRD)); // duplicate open report
  assertEquals((await asUser(db, THIRD, 'select * from public.content_reports')).length, 1);
  assertEquals((await asUser(db, OTHER, 'select * from public.content_reports')).length, 0); // reported user can't see it
  // can't file a report as someone else, or pre-resolve it
  await assertRejects(() =>
    asUser(db, THIRD, `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values ($1::uuid, 'user', $1::text, $1::uuid, 'spam')`, [OTHER]),
  );
  await assertRejects(() =>
    asUser(db, THIRD, `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason, status) values ($1, 'user', $2::text, $2::uuid, 'spam', 'dismissed')`, [THIRD, ME]),
  );
});

Deno.test('moderation: only admins see the queue; removing content resolves its reports', async () => {
  const db = await setup();
  const reviewId = (await asOwner<{ id: string }>(db, `select id from public.reviews where user_id = '${OTHER}'`))[0]!.id;
  const listId = (await asOwner<{ id: string }>(db, `select id from public.lists where user_id = '${OTHER}'`))[0]!.id;
  await asUser(db, THIRD, `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values
    ($1, 'review', $2, $3, 'hate'), ($1, 'list', $4, $3, 'spam'), ($1, 'rating', '2', $3, 'other')`, [THIRD, reviewId, OTHER, listId]);

  await assertRejects(() => asUser(db, THIRD, 'select * from public.admin_reports()'), Error, 'admins');
  const queue = await asUser<{ target_type: string; preview: string; content_exists: boolean; target_username: string; reporter_username: string }>(
    db, ME, 'select * from public.admin_reports()',
  );
  assertEquals(queue.map((q) => [q.target_type, q.preview, q.content_exists, q.target_username, q.reporter_username]), [
    ['review', 'rude review', true, 'other', 'third'],
    ['list', "Other's list", true, 'other', 'third'],
    ['rating', 'Rated game #2: 10/100', true, 'other', 'third'],
  ]);

  await assertRejects(() => asUser(db, THIRD, `select public.admin_resolve_reports('review', $1, $2, true)`, [reviewId, OTHER]), Error, 'admins');
  await asUser(db, ME, `select public.admin_resolve_reports('review', $1, $2, true, 'hate speech')`, [reviewId, OTHER]);
  await asUser(db, ME, `select public.admin_resolve_reports('list', $1, $2, false)`, [listId, OTHER]); // dismissed: list stays
  await asUser(db, ME, `select public.admin_resolve_reports('rating', '2', $1, true)`, [OTHER]);
  assertEquals((await asOwner(db, 'select * from public.reviews')).length, 0);
  assertEquals((await asOwner(db, 'select * from public.lists')).length, 1);
  assertEquals((await asOwner(db, `select * from public.game_ratings where user_id = '${OTHER}' and game_id = 2`)).length, 0);
  const statuses = await asOwner<{ target_type: string; status: string }>(db, 'select target_type, status from public.content_reports order by target_type');
  assertEquals(statuses.map((s) => [s.target_type, s.status]), [['review', 'actioned'], ['list', 'dismissed'], ['rating', 'actioned']]);
  assertEquals((await asUser(db, ME, 'select * from public.admin_reports()')).length, 0); // queue empty
});

Deno.test('terms: users record and read only their own acceptance', async () => {
  const db = await setup();
  await asUser(db, THIRD, `insert into public.terms_acceptances (user_id, version) values ($1, '2026-11-03')`, [THIRD]);
  await assertRejects(() => asUser(db, THIRD, `insert into public.terms_acceptances (user_id, version) values ($1, '2026-11-03')`, [OTHER]));
  assertEquals((await asUser(db, OTHER, 'select * from public.terms_acceptances')).length, 0);
  assertEquals((await asUser(db, THIRD, 'select version from public.terms_acceptances')).length, 1);
});

Deno.test('account deletion: deleting the profile cascades every safety table', async () => {
  const db = await setup();
  await asUser(db, THIRD, `select public.block_user('${OTHER}')`);
  await asUser(db, OTHER, `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values ($1, 'user', $2::text, $2::uuid, 'spam')`, [OTHER, ME]);
  await asUser(db, OTHER, `insert into public.terms_acceptances (user_id, version) values ($1, 'v1')`, [OTHER]);
  await asOwner(db, `delete from public.profiles where id = '${OTHER}'`);
  assertEquals(await asOwner(db, 'select * from public.user_blocks'), []);
  assertEquals(await asOwner(db, 'select * from public.terms_acceptances'), []);
  // a report they filed stays for moderation history, anonymised
  assertEquals((await asOwner<{ reporter_id: string | null }>(db, 'select reporter_id from public.content_reports'))[0]!.reporter_id, null);
});
