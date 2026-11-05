/**
 * Migration 000040: replays — many reviews per game (one draft), the current
 * review's score is your score, plain replays from the game page, counts,
 * feed items, the review browser and Stats → Replays.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER, setGuest, THIRD } from './_setup.ts';

type Rev = { id: string; is_replay: boolean; finished_on: string | null; rating: number | null };

const review = async (db: PGlite, uid: string, gameId: number, score: number | null, status = 'published', extra = '') =>
  (
    await asUser<Rev>(
      db,
      uid,
      `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status${extra ? ', is_replay' : ''})
       values ($1, $2, ${numeric(score)}, 'text', '${status}'${extra ? `, ${extra}` : ''})
       returning id, is_replay, finished_on::text, rating`,
      [uid, gameId],
    )
  )[0]!;

const myScore = async (db: PGlite, uid: string, gameId: number) =>
  (await asOwner<{ rating: number }>(db, `select rating from public.game_ratings where user_id = '${uid}' and game_id = ${gameId}`))[0]
    ?.rating ?? null;

const replay = (db: PGlite, uid: string, gameId: number, finished = 'current_date', platform: number | null = null) =>
  asUser(db, uid, `insert into public.game_replays (user_id, game_id, finished_on, platform_id) values ($1, $2, ${finished}, $3)`, [
    uid,
    gameId,
    platform,
  ]);

const friends = (db: PGlite, a: string, b: string) =>
  asOwner(db, `insert into public.friendships (user_id, friend_id, status) values ('${a}', '${b}', 'accepted')`);

Deno.test('a second review of a game is a replay with a finish date; only one draft per game', async () => {
  const db = await freshDb();
  const first = await review(db, ME, 1, 60);
  assertEquals(first.is_replay, false);
  assertEquals(first.finished_on, null);

  const second = await review(db, ME, 1, 90);
  assertEquals(second.is_replay, true); // server-set
  assertEquals(typeof second.finished_on, 'string'); // defaults to today

  // Can't un-mark it, or move it to another game.
  await asUser(db, ME, 'update public.reviews set is_replay = false, game_id = 2 where id = $1', [second.id]);
  assertEquals((await asOwner<Rev>(db, `select is_replay from public.reviews where id = '${second.id}'`))[0]!.is_replay, true);
  assertEquals((await asOwner<{ n: number }>(db, `select count(*)::int n from public.reviews where game_id = 2`))[0]!.n, 0);

  await review(db, ME, 1, 70, 'draft');
  await assertRejects(() => review(db, ME, 1, 75, 'draft')); // one draft per game
  await assertRejects(() =>
    asUser(db, ME, `update public.reviews set finished_on = current_date + 10 where id = $1`, [second.id]),
  ); // RP001: no future finish dates
});

Deno.test('the newest review sets your score; older reviews keep theirs; stars change only the newest', async () => {
  const db = await freshDb();
  const first = await review(db, ME, 1, 60);
  assertEquals(await myScore(db, ME, 1), 60);
  const second = await review(db, ME, 1, 90);
  assertEquals(await myScore(db, ME, 1), 90);

  // Editing the older review's score doesn't touch your score.
  await asUser(db, ME, `update public.reviews set rating = 40, rating_input = '40' where id = $1`, [first.id]);
  assertEquals(await myScore(db, ME, 1), 90);

  // Game page stars → newest review only.
  await asUser(db, ME, `update public.game_ratings set rating = 85, rating_input = '85' where user_id = $1 and game_id = 1`, [ME]);
  const scores = await asOwner<{ id: string; rating: number }>(db, `select id, rating from public.reviews where user_id = '${ME}' order by created_at`);
  assertEquals(
    scores.map((s) => s.rating),
    [40, 85],
  );

  // Deleting the newest review puts your score back to the one before it.
  await asUser(db, ME, 'delete from public.reviews where id = $1', [second.id]);
  assertEquals(await myScore(db, ME, 1), 40);
});

Deno.test('a replay draft changes your score only when it is published; unpublishing hands it back', async () => {
  const db = await freshDb();
  await review(db, ME, 1, 60);
  const draft = await review(db, ME, 1, 95, 'draft');
  assertEquals(draft.is_replay, true);
  assertEquals(await myScore(db, ME, 1), 60);

  await asUser(db, ME, `update public.reviews set status = 'published' where id = $1`, [draft.id]);
  assertEquals(await myScore(db, ME, 1), 95);

  await asUser(db, ME, `update public.reviews set status = 'draft' where id = $1`, [draft.id]);
  assertEquals(await myScore(db, ME, 1), 60);

  // Discarding the replay draft leaves the score alone.
  await asUser(db, ME, 'delete from public.reviews where id = $1', [draft.id]);
  assertEquals(await myScore(db, ME, 1), 60);
});

Deno.test('a first review ticked "This is a replay" (quick-rated before) counts as a replay', async () => {
  const db = await freshDb();
  await asUser(db, ME, `insert into public.game_ratings (user_id, game_id, ${'rating, rating_input_scale, rating_input'}) values ($1, 1, ${numeric(50)})`, [ME]);
  const r = await review(db, ME, 1, 80, 'published', 'true');
  assertEquals(r.is_replay, true);
  assertEquals(await myScore(db, ME, 1), 80);
  const counts = await asUser<{ replays: number }>(db, OTHER, 'select replays from public.user_ratings_table($1)', [ME]);
  assertEquals(counts[0]!.replays, 1);
});

Deno.test('plain replays: owner only, members only, no future dates, leave the backlog, hidden when blocked', async () => {
  const db = await freshDb();
  await asUser(db, ME, 'insert into public.game_backlog (user_id, game_id) values ($1, 1)', [ME]);
  await replay(db, ME, 1, `date '2019-05-01'`, 6);
  assertEquals((await asOwner<{ n: number }>(db, `select count(*)::int n from public.game_backlog`))[0]!.n, 0);

  await assertRejects(() => asUser(db, OTHER, `insert into public.game_replays (user_id, game_id) values ($1, 1)`, [ME])); // not yours
  await assertRejects(() => replay(db, ME, 1, 'current_date + 5'));
  // No updates: replays are added or deleted.
  await asUser(db, ME, `update public.game_replays set finished_on = date '2000-01-01'`);
  assertEquals((await asOwner<{ d: string }>(db, `select finished_on::text d from public.game_replays where user_id = '${ME}'`))[0]!.d, '2019-05-01');

  assertEquals((await asUser(db, THIRD, `select 1 from public.game_replays where user_id = $1`, [ME])).length, 1);
  await asUser(db, ME, 'select public.block_user($1)', [THIRD]);
  assertEquals((await asUser(db, THIRD, `select 1 from public.game_replays where user_id = $1`, [ME])).length, 0);

  await setGuest(db, true);
  await assertRejects(() => replay(db, OTHER, 2));
});

Deno.test('counts: friends’ ratings, ratings list, most replayed; no duplicate rows with many reviews', async () => {
  const db = await freshDb();
  await friends(db, ME, OTHER);
  await review(db, OTHER, 1, 60);
  const newest = await review(db, OTHER, 1, 80);
  await replay(db, OTHER, 1);
  await replay(db, OTHER, 1);
  await review(db, OTHER, 2, 70);
  await replay(db, OTHER, 2);

  const fr = await asUser<{ review_id: string; replays: number; rating: number }>(db, ME, 'select * from public.friend_ratings_for_game(1)');
  assertEquals(fr.length, 1);
  assertEquals(fr[0]!.replays, 3);
  assertEquals(fr[0]!.review_id, newest.id);
  assertEquals(fr[0]!.rating, 80);

  const table = await asUser<{ game_id: number; replays: number }>(db, ME, 'select game_id, replays from public.user_ratings_table($1) order by game_id', [OTHER]);
  assertEquals(
    table.map((t) => [Number(t.game_id), t.replays]),
    [
      [1, 3],
      [2, 1],
    ],
  );

  const batch = await asUser<{ game_id: number; replays: number }>(db, ME, 'select * from public.replay_counts($1, $2) order by game_id', [OTHER, [1, 2, 3]]);
  assertEquals(
    batch.map((b) => [Number(b.game_id), b.replays]),
    [
      [1, 3],
      [2, 1],
    ],
  );

  const top = await asUser<{ game_id: number; replays: number }>(db, ME, 'select * from public.most_replayed_game($1)', [OTHER]);
  assertEquals([Number(top[0]!.game_id), top[0]!.replays], [1, 3]);
  assertEquals((await asUser(db, ME, 'select * from public.most_replayed_game($1)', [THIRD])).length, 0);
});

Deno.test('review browser shows each player’s newest review; playthroughs list them all', async () => {
  const db = await freshDb();
  const a = await review(db, OTHER, 1, 60);
  const b = await review(db, OTHER, 1, 80);
  await review(db, THIRD, 1, 70);
  const rows = await asUser<{ id: string; is_replay: boolean }>(db, ME, `select id, is_replay from public.game_reviews_browse(1)`);
  assertEquals(rows.length, 2);
  assertEquals(rows.find((r) => r.id === b.id)?.is_replay, true);
  assertEquals(rows.some((r) => r.id === a.id), false);

  const pts = await asUser<{ id: string; n: number; total: number }>(db, ME, 'select id, n, total from public.review_playthroughs($1)', [a.id]);
  assertEquals(
    pts.map((p) => [p.id, p.n, p.total]),
    [
      [a.id, 1, 2],
      [b.id, 2, 2],
    ],
  );
});

Deno.test('feed: friends’ plain replays are items; replay reviews are marked', async () => {
  const db = await freshDb();
  await friends(db, ME, OTHER);
  await review(db, OTHER, 1, 60);
  await review(db, OTHER, 1, 80);
  await replay(db, OTHER, 2);
  const feed = await asUser<{ kind: string; is_replay: boolean; game_id: number }>(db, ME, `select kind, is_replay, game_id from public.activity_feed('friends')`);
  assertEquals(
    feed.map((f) => [f.kind, f.is_replay, Number(f.game_id)]),
    [
      ['replay', true, 2],
      ['review', true, 1],
      ['review', false, 1],
    ],
  );
  // Community has reviews only.
  const community = await asUser<{ kind: string }>(db, ME, `select kind from public.activity_feed('community')`);
  assertEquals(
    community.map((c) => c.kind),
    ['review', 'review'],
  );
});

Deno.test('Stats → Replays, and replay-only games count as logged once', async () => {
  const db = await freshDb();
  await review(db, ME, 1, 50);
  await review(db, ME, 1, 90);
  await replay(db, ME, 1, `date '2021-03-01'`);
  await replay(db, ME, 3, `date '2021-07-01'`, 48);

  type ReplayStats = {
    total: number;
    games: number;
    top: { gameId: number; replays: number; lastFinished: string }[];
    byYear: { year: number; replays: number }[];
    scoreChanges: { gameId: number; first: number; latest: number; reviews: number }[];
  };
  const stats = (await asUser<{ s: ReplayStats }>(db, ME, 'select public.stats_replays() s'))[0]!.s;
  assertEquals(stats.total, 3);
  assertEquals(stats.games, 2);
  assertEquals([stats.top[0]!.gameId, stats.top[0]!.replays], [1, 2]);
  assertEquals(stats.byYear.find((y) => y.year === 2021)?.replays, 2);
  assertEquals(stats.scoreChanges, [{ gameId: 1, reviews: 2, first: 50, latest: 90 }]);

  const logged = await asUser<{ game_id: number; platform_id: number | null }>(db, ME, 'select game_id, platform_id from public.my_logged_games() order by game_id');
  assertEquals(
    logged.map((l) => [Number(l.game_id), l.platform_id === null ? null : Number(l.platform_id)]),
    [
      [1, null],
      [3, 48],
    ],
  );
});

Deno.test('account deletion removes replays and reviews without errors', async () => {
  const db = await freshDb();
  await review(db, ME, 1, 50);
  await review(db, ME, 1, 90);
  await replay(db, ME, 1);
  await asOwner(db, `delete from public.profiles where id = '${ME}'`);
  assertEquals((await asOwner<{ n: number }>(db, 'select (select count(*) from public.reviews) + (select count(*) from public.game_replays) n'))[0]!.n, 0);
});
