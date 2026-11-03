/**
 * Migration 000020: trending games + trending posts.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';

const rated = (uid: string, gameId: number, score: number, daysAgo: number) =>
  `('${uid}', ${gameId}, ${score}, 'numeric', '${score}', now() - interval '${daysAgo} days', now() - interval '${daysAgo} days')`;

Deno.test('trending games: most players recently, old activity ignored', async () => {
  const db = await freshDb();
  await asOwner(db, `alter table public.game_ratings disable trigger game_ratings_touch`);
  await asOwner(db, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, created_at, updated_at) values
    ${rated(ME, 1, 90, 1)}, ${rated(OTHER, 1, 70, 2)}, ${rated(THIRD, 1, 80, 3)},
    ${rated(ME, 2, 60, 1)}, ${rated(OTHER, 2, 50, 1)},
    ${rated(ME, 3, 99, 40)}, ${rated(OTHER, 3, 99, 40)}, ${rated(THIRD, 3, 99, 40)}`);
  const rows = await asUser<{ game_id: number; players: number; average_rating: string }>(db, ME, 'select * from public.trending_games(14, 10)');
  assertEquals(rows.map((r) => [Number(r.game_id), r.players, Number(r.average_rating)]), [
    [1, 3, 80],
    [2, 2, 55],
  ]); // game 3 was only rated 40 days ago
});

Deno.test("trending posts: recent published reviews of trending games, never drafts", async () => {
  const db = await freshDb();
  await asUser(db, OTHER, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ($1, 1, 80, 'numeric', '80', 'Great', 'published')`, [OTHER]);
  await asUser(db, THIRD, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ($1, 1, 70, 'numeric', '70', 'Good', 'published')`, [THIRD]);
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ($1, 2, 50, 'numeric', '50', 'Meh', 'published')`, [ME]);
  await asUser(db, ME, `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status) values ($1, 3, 50, 'numeric', '50', 'secret draft', 'draft')`, [ME]);
  const rows = await asUser<{ game_id: number; actor_username: string; excerpt: string; kind: string }>(db, ME, 'select * from public.trending_posts(14, 10)');
  // game 1 (2 players) before game 2 (1 player); the draft never appears
  assertEquals(rows.map((r) => [Number(r.game_id), r.excerpt]).slice(0, 1)[0]![0], 1);
  assertEquals(rows.map((r) => r.excerpt).sort(), ['Good', 'Great', 'Meh']);
  assertEquals(rows.every((r) => r.kind === 'review'), true);
});
