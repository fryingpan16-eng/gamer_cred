/**
 * Migration 000031: row rules evaluate their helpers once per request, not per row.
 * Behaviour is covered by the blocking / guest / admin tests; this checks the form.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER, THIRD } from './_setup.ts';

type Policy = { policyname: string; qual: string | null; with_check: string | null };

Deno.test('no row rule calls a helper per row any more', async () => {
  const db = await freshDb();
  const policies = await asOwner<Policy>(db, `select policyname, qual, with_check from pg_policies where schemaname in ('public', 'storage')`);
  for (const p of policies) {
    const text = `${p.qual ?? ''} ${p.with_check ?? ''}`;
    assertEquals(/is_hidden_user\(/.test(text), false, `${p.policyname} still checks blocking per row`);
    // Every is_guest / is_app_admin call sits inside a one-off sub-select.
    const bare = text.replace(/\(\s*SELECT\s+(public\.)?(is_guest|is_app_admin)\(\)[^)]*\)/gi, '');
    assertEquals(/(is_guest|is_app_admin)\(\)/.test(bare), false, `${p.policyname} calls a helper per row`);
  }
});

Deno.test('the hidden list covers both directions, and players cannot call it to learn who blocked them', async () => {
  const db = await freshDb();
  await asUser(db, ME, 'select public.block_user($1)', [OTHER]);
  // It's no longer in the API-exposed schema.
  await assertRejects(() => asUser(db, OTHER, 'select public.my_hidden_user_ids()'));
  // (Row rules call it as the signed-in user; the API only exposes the public schema.)
  const hidden = async (uid: string) => (await asUser<{ ids: string[] }>(db, uid, 'select private.hidden_user_ids() as ids'))[0]!.ids;
  assertEquals([await hidden(ME), await hidden(OTHER), await hidden(THIRD)], [[OTHER], [ME], []]);
  // And it still hides profiles both ways.
  const names = async (uid: string) => (await asUser<{ username: string }>(db, uid, 'select username from public.profiles order by 1')).map((r) => r.username);
  assertEquals(await names(ME), ['me', 'third']);
  assertEquals(await names(OTHER), ['other', 'third']);
  assertEquals(await names(THIRD), ['me', 'other', 'third']);
});
