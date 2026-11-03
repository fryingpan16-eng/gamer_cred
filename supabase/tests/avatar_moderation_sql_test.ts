/**
 * Migration 000022: profile pictures go through the screening function.
 *   cd supabase/tests && deno test -A
 */
import { assertEquals, assertRejects } from '@std/assert';

import { asOwner, asUser, freshDb, ME, OTHER } from './_setup.ts';

Deno.test('users cannot point their profile at a new picture; clearing it and other edits still work', async () => {
  const db = await freshDb();
  await asOwner(db, `update public.profiles set avatar_url = 'https://cdn/old.jpg' where id = '${ME}'`); // server (owner role) may
  await assertRejects(
    () => asUser(db, ME, `update public.profiles set avatar_url = 'https://evil.example/x.jpg' where id = '${ME}'`),
    Error,
    'picture check',
  );
  await asUser(db, ME, `update public.profiles set username = 'renamed' where id = '${ME}'`);
  await asUser(db, ME, `update public.profiles set avatar_url = null where id = '${ME}'`);
  assertEquals(await asOwner(db, `select username, avatar_url from public.profiles where id = '${ME}'`), [{ username: 'renamed', avatar_url: null }]);
});

Deno.test('uploads: only <uid>/pending.jpg in the private bucket; public avatars bucket is server-only', async () => {
  const db = await freshDb();
  assertEquals(await asOwner(db, `select public from storage.buckets where id = 'avatar-uploads'`), [{ public: false }]);
  await asUser(db, ME, `insert into storage.objects (bucket_id, name) values ('avatar-uploads', '${ME}/pending.jpg')`);
  for (const name of [`${OTHER}/pending.jpg`, `${ME}/other.jpg`, `held/${ME}.jpg`]) {
    await assertRejects(() => asUser(db, ME, `insert into storage.objects (bucket_id, name) values ('avatar-uploads', '${name}')`));
  }
  await assertRejects(() => asUser(db, ME, `insert into storage.objects (bucket_id, name) values ('avatars', '${ME}/avatar.jpg')`));
  // Nobody else can see a pending upload.
  assertEquals((await asUser(db, OTHER, `select 1 from storage.objects where bucket_id = 'avatar-uploads'`)).length, 0);
});

Deno.test('held pictures: owner sees their own row only; cascades with the profile', async () => {
  const db = await freshDb();
  await asOwner(db, `insert into public.avatar_reviews (user_id, held_path, reason) values ('${ME}', 'held/${ME}.jpg', 'possible_adult')`);
  assertEquals((await asUser(db, ME, 'select reason from public.avatar_reviews')).length, 1);
  assertEquals((await asUser(db, OTHER, 'select reason from public.avatar_reviews')).length, 0);
  await assertRejects(() => asUser(db, ME, `delete from public.avatar_reviews where user_id = '${ME}' returning 1`).then((r) => {
    if (r.length === 0) throw new Error('no delete policy');
  }));
});
