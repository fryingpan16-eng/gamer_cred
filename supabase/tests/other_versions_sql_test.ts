/**
 * Migration 000042: other versions (Director's Cut…) fold into their original.
 * merge_game_version moves saved data; later saves on the old id land on the original.
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER } from './_setup.ts';

const ORIGINAL = 100; // Death Stranding
const VERSION = 200; // Death Stranding Director's Cut

const review = (db: PGlite, uid: string, gameId: number, score: number | null, status = 'published') =>
  asUser(
    db,
    uid,
    `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status)
     values ($1, $2, ${numeric(score)}, 'text', '${status}')`,
    [uid, gameId],
  );

const rate = (db: PGlite, uid: string, gameId: number, score: number) =>
  asUser(
    db,
    uid,
    `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ($1, $2, ${numeric(score)})`,
    [uid, gameId],
  );

const merge = (db: PGlite, from = VERSION, to = ORIGINAL) =>
  asOwner<{ n: number }>(db, `select public.merge_game_version(${from}, ${to}) as n`);

const count = async (db: PGlite, sql: string) => (await asOwner<{ n: number }>(db, `select count(*)::int n from ${sql}`))[0]!.n;

const score = async (db: PGlite, uid: string, gameId: number) =>
  (await asOwner<{ rating: number }>(db, `select rating from public.game_ratings where user_id = '${uid}' and game_id = ${gameId}`))[0]
    ?.rating ?? null;

Deno.test('a version\'s reviews, rating and replays move to the original', async () => {
  const db = await freshDb();
  await review(db, ME, VERSION, 80);
  await asUser(db, ME, `insert into public.game_replays (user_id, game_id) values ($1, ${VERSION})`, [ME]);
  await asUser(db, OTHER, `insert into public.game_likes (user_id, game_id) values ($1, ${VERSION})`, [OTHER]);

  const [moved] = await merge(db);
  assertEquals(moved!.n, 4); // review, rating (synced from it), replay, like
  assertEquals(await count(db, `public.reviews where game_id = ${VERSION}`), 0);
  assertEquals(await count(db, `public.reviews where game_id = ${ORIGINAL}`), 1);
  assertEquals(await score(db, ME, ORIGINAL), 80);
  assertEquals(await count(db, `public.game_replays where game_id = ${ORIGINAL}`), 1);
  assertEquals(await count(db, `public.game_likes where game_id = ${ORIGINAL}`), 1);
  assertEquals((await asOwner<{ to_id: number }>(db, `select to_id from public.game_merges where from_id = ${VERSION}`))[0]!.to_id, ORIGINAL);

  // Again: nothing left to move.
  assertEquals((await merge(db))[0]!.n, 0);
});

Deno.test('reviewed both: the later review becomes a replay and sets the score', async () => {
  const db = await freshDb();
  await review(db, ME, ORIGINAL, 60);
  await review(db, ME, VERSION, 90);
  await merge(db);

  const rows = await asOwner<{ is_replay: boolean; rating: number; has_finish: boolean }>(
    db,
    `select is_replay, rating, finished_on is not null as has_finish from public.reviews where user_id = '${ME}' order by created_at, id`,
  );
  assertEquals(rows, [
    { is_replay: false, rating: 60, has_finish: false },
    { is_replay: true, rating: 90, has_finish: true },
  ]);
  assertEquals(await score(db, ME, ORIGINAL), 90);
  assertEquals(await count(db, `public.game_ratings where game_id = ${VERSION}`), 0);
});

Deno.test('two drafts: the newer stays (one draft per game)', async () => {
  const db = await freshDb();
  await review(db, ME, ORIGINAL, null, 'draft');
  await review(db, ME, VERSION, null, 'draft');
  const newer = (await asOwner<{ id: string }>(db, `select id from public.reviews where game_id = ${VERSION}`))[0]!.id;
  await merge(db);
  assertEquals(await asOwner<{ id: string }>(db, `select id from public.reviews where user_id = '${ME}'`), [{ id: newer }]);
});

Deno.test('rated both, no review: the newer rating stays', async () => {
  const db = await freshDb();
  await rate(db, ME, VERSION, 40);
  await rate(db, ME, ORIGINAL, 70);
  await merge(db);
  assertEquals(await score(db, ME, ORIGINAL), 70);
  assertEquals(await count(db, `public.game_ratings where user_id = '${ME}'`), 1);
});

Deno.test('Now Playing, Top 4, lists and backlog keep one copy', async () => {
  const db = await freshDb();
  await db.exec(
    `insert into public.now_playing (user_id, slot_index, game_id) values ('${ME}', 1, ${ORIGINAL}), ('${ME}', 2, ${VERSION});
     update public.now_playing set updated_at = now() - interval '1 day' where game_id = ${ORIGINAL};
     insert into public.user_favorites (user_id, rank, game_id) values ('${ME}', 1, ${VERSION}), ('${ME}', 3, ${ORIGINAL});
     insert into public.game_backlog (user_id, game_id) values ('${ME}', ${VERSION}), ('${OTHER}', ${VERSION});`,
  );
  const [list] = await asOwner<{ id: string }>(db, `insert into public.lists (user_id, title) values ('${ME}', 'Mine') returning id`);
  await asOwner(db, `insert into public.list_items (list_id, game_id, position) values ('${list!.id}', ${ORIGINAL}, 1), ('${list!.id}', ${VERSION}, 2)`);

  await merge(db);
  assertEquals(await asOwner(db, `select slot_index, game_id::int from public.now_playing where user_id = '${ME}'`), [
    { slot_index: 2, game_id: ORIGINAL },
  ]);
  assertEquals(await asOwner(db, `select rank, game_id::int from public.user_favorites where user_id = '${ME}'`), [
    { rank: 1, game_id: ORIGINAL },
  ]);
  assertEquals(await count(db, `public.list_items where game_id = ${ORIGINAL}`), 1);
  assertEquals(await count(db, `public.list_items where game_id = ${VERSION}`), 0);
  assertEquals(await count(db, `public.game_backlog where game_id = ${ORIGINAL}`), 2);
});

Deno.test('after a merge, saves on the old id land on the original', async () => {
  const db = await freshDb();
  await merge(db);
  await rate(db, ME, VERSION, 55);
  assertEquals(await score(db, ME, ORIGINAL), 55);
  await review(db, OTHER, VERSION, 75);
  assertEquals(await count(db, `public.reviews where game_id = ${ORIGINAL}`), 1);
  // Anyone can read the merges (IGDB data); nobody can write them.
  assertEquals((await asUser(db, ME, 'select from_id from public.game_merges')).length, 1);
  await assertRejects(() => asUser(db, ME, `insert into public.game_merges (from_id, to_id) values (1, 2)`));
});

Deno.test('chains resolve to the final game; bad pairs are refused', async () => {
  const db = await freshDb();
  await merge(db, 300, VERSION); // an older version folded into the Director's Cut…
  await merge(db, VERSION, ORIGINAL); // …which folds into the original
  assertEquals((await asOwner<{ to_id: number }>(db, `select to_id from public.game_merges where from_id = 300`))[0]!.to_id, ORIGINAL);
  await merge(db, 400, VERSION); // a merge into a folded id goes to its original
  assertEquals((await asOwner<{ to_id: number }>(db, `select to_id from public.game_merges where from_id = 400`))[0]!.to_id, ORIGINAL);
  await assertRejects(() => merge(db, ORIGINAL, ORIGINAL));
  await assertRejects(() => merge(db, ORIGINAL, VERSION)); // loop
});
