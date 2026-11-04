/**
 * Migration 000031: row rules evaluate their helpers once per request, not per row.
 * Behaviour is covered by the blocking / guest / admin tests; this checks the form.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals } from '@std/assert';

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

Deno.test('the hidden list covers both directions and nothing else', async () => {
  const db = await freshDb();
  await asUser(db, ME, 'select public.block_user($1)', [OTHER]);
  const mine = (await asUser<{ ids: string[] }>(db, ME, 'select public.my_hidden_user_ids() as ids'))[0]!.ids;
  const theirs = (await asUser<{ ids: string[] }>(db, OTHER, 'select public.my_hidden_user_ids() as ids'))[0]!.ids;
  const third = (await asUser<{ ids: string[] }>(db, THIRD, 'select public.my_hidden_user_ids() as ids'))[0]!.ids;
  assertEquals([mine, theirs, third], [[OTHER], [ME], []]);
  // And it still hides profiles both ways.
  const names = async (uid: string) => (await asUser<{ username: string }>(db, uid, 'select username from public.profiles order by 1')).map((r) => r.username);
  assertEquals(await names(ME), ['me', 'third']);
  assertEquals(await names(OTHER), ['other', 'third']);
  assertEquals(await names(THIRD), ['me', 'other', 'third']);
});
