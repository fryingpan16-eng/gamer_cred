/**
 * Migration 000033: bug fixes from the full code review (batch 1).
 *   cd supabase/tests && deno test -A
 */
import type { PGlite } from '@electric-sql/pglite';
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, numeric, OTHER, THIRD } from './_setup.ts';

async function withSignupTrigger(db: PGlite) {
  await asOwner(db, `create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()`);
}

Deno.test('sign-up: email sign-ups cannot set a picture; Google sign-ins keep theirs', async () => {
  const db = await freshDb();
  await withSignupTrigger(db);
  await asOwner(
    db,
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
      ('00000000-0000-0000-0000-0000000000e1', 'a@x.y', '{"username":"emailer","avatar_url":"https://evil.example/x.jpg"}', '{"provider":"email"}')`,
  );
  await asOwner(
    db,
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
      ('00000000-0000-0000-0000-0000000000e2', 'b@x.y', '{"full_name":"Goog Ler","picture":"https://lh3.googleusercontent.com/p.jpg"}', '{"provider":"google"}')`,
  );
  const pics = await asOwner<{ id: string; avatar_url: string | null }>(db, `select id, avatar_url from public.profiles where id::text like '%e_' order by id`);
  assertEquals(pics.map((p) => p.avatar_url), [null, 'https://lh3.googleusercontent.com/p.jpg']);
});

Deno.test('Register can check usernames before signing in', async () => {
  const db = await freshDb();
  await db.exec(`grant execute on function public.is_username_available(text) to anon`);
  const check = async (name: string) => {
    await db.exec(`reset role; select set_config('test.uid', '', false); set role anon;`);
    try {
      return (await db.query<{ ok: boolean }>('select public.is_username_available($1) as ok', [name])).rows[0]!.ok;
    } finally {
      await db.exec('reset role;');
    }
  };
  assertEquals(await check('ME'), false); // taken ('me'), case-insensitive
  assertEquals(await check('fresh_name'), true);
  assertEquals(await check('x'), false); // invalid
});

Deno.test("nobody can ask whether someone blocked them", async () => {
  const db = await freshDb();
  await asUser(db, ME, 'select public.block_user($1)', [OTHER]);
  assertEquals((await asUser<{ s: string }>(db, OTHER, 'select public.block_state($1) as s', [ME]))[0]!.s, 'none');
  assertEquals((await asUser<{ s: string }>(db, ME, 'select public.block_state($1) as s', [OTHER]))[0]!.s, 'blocked_by_me');
  await assertRejects(() => asUser(db, OTHER, 'select public.is_hidden_user($1)', [ME]));
});

Deno.test('reports name the real owner; rating reports are per player', async () => {
  const db = await freshDb();
  const review = (
    await asOwner<{ id: string }>(
      db,
      `insert into public.reviews (user_id, game_id, rating, rating_input_scale, rating_input, content, status)
       values ('${OTHER}', 5, ${numeric(80)}, 'nice', 'published') returning id`,
    )
  )[0]!.id;
  const report = (type: string, targetId: string, targetUser: string) =>
    asUser(
      db,
      ME,
      `insert into public.content_reports (reporter_id, target_type, target_id, target_user_id, reason) values ($1, $2::public.report_target, $3, $4, 'spam')`,
      [ME, type, targetId, targetUser],
    );
  // Claims the review is THIRD's; stored as OTHER's (the real author).
  await report('review', review, THIRD);
  assertEquals((await asOwner<{ target_user_id: string }>(db, `select target_user_id from public.content_reports`))[0]!.target_user_id, OTHER);
  await assertRejects(() => report('review', '00000000-0000-0000-0000-000000000999', OTHER), Error, 'no longer exists');

  // Two players' ratings of the same game are separate reports.
  for (const uid of [OTHER, THIRD]) {
    await asOwner(db, `insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input) values ('${uid}', 9, 50, 'numeric', '50')`);
  }
  await report('rating', '9', OTHER);
  await report('rating', '9', THIRD);
  await assertRejects(() => report('rating', '9', ME)); // ME has no rating of game 9

  // Resolving OTHER's rating report leaves THIRD's open.
  await asOwner(db, `insert into public.app_admins (user_id) values ('${ME}')`);
  assertEquals((await asUser<{ n: number }>(db, ME, `select public.admin_resolve_reports('rating', '9', $1, false) as n`, [OTHER]))[0]!.n, 1);
  const open = await asOwner<{ target_user_id: string }>(db, `select target_user_id from public.content_reports where target_type = 'rating' and status = 'open'`);
  assertEquals(open.map((r) => r.target_user_id), [THIRD]);
});
