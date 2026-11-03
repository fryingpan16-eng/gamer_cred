-- =============================================================================
-- gamer_cred — 000022 profile picture screening
--
-- Pictures are checked before anyone else can see them:
--   1. The app uploads to the PRIVATE `avatar-uploads` bucket at
--      <uid>/pending.jpg (the only path a user may write there).
--   2. The `avatar` Edge Function scores it with Google Cloud Vision SafeSearch,
--      then (service role) publishes it to avatars/<uid>/avatar.jpg, rejects it,
--      or holds it at held/<uid>.jpg for an admin (avatar_reviews row).
--
-- So users can no longer write to the public `avatars` bucket, and only the
-- server may point profiles.avatar_url at a new picture (clearing it is fine).
-- Pictures that are already live are untouched.
-- =============================================================================

-- 1. Private upload bucket ------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatar-uploads', 'avatar-uploads', false, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Exactly one writable object per user: avatar-uploads/<uid>/pending.jpg.
-- (held/<uid>.jpg is written by the service role only.)
create policy "avatar-uploads: owner reads own pending"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatar-uploads' and name = (select auth.uid())::text || '/pending.jpg');

create policy "avatar-uploads: owner uploads own pending"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatar-uploads' and name = (select auth.uid())::text || '/pending.jpg');

create policy "avatar-uploads: owner replaces own pending"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatar-uploads' and name = (select auth.uid())::text || '/pending.jpg')
  with check (bucket_id = 'avatar-uploads' and name = (select auth.uid())::text || '/pending.jpg');

create policy "avatar-uploads: owner deletes own pending"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatar-uploads' and name = (select auth.uid())::text || '/pending.jpg');

-- 2. Public bucket: users may still read + delete their own files (Remove
--    picture), but only the screening function writes new ones.
drop policy if exists "avatars: owner uploads to own folder" on storage.objects;
drop policy if exists "avatars: owner replaces own files" on storage.objects;

-- 3. Only the server sets a new picture URL ------------------------------------
create or replace function public.profiles_guard_avatar()
returns trigger
language plpgsql
as $$
begin
  if new.avatar_url is distinct from old.avatar_url
     and new.avatar_url is not null
     and current_user in ('authenticated', 'anon') then
    raise exception 'Profile pictures are set through the picture check.' using errcode = 'AV001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_avatar on public.profiles;
create trigger profiles_guard_avatar
  before update of avatar_url on public.profiles
  for each row execute function public.profiles_guard_avatar();

-- 4. Pictures waiting for an admin ----------------------------------------------
create table public.avatar_reviews (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  -- Object in avatar-uploads (held/<uid>.jpg).
  held_path   text not null,
  -- Why it was held: 'possible_adult', 'check_unavailable', …
  reason      text not null,
  -- SafeSearch likelihoods, for the admin.
  scores      jsonb,
  created_at  timestamptz not null default now()
);

create index avatar_reviews_created_at_idx on public.avatar_reviews (created_at);

alter table public.avatar_reviews enable row level security;

-- Users see whether their own picture is waiting; admins act through the Edge Function.
create policy "avatar_reviews: owner reads own"
  on public.avatar_reviews for select to authenticated
  using ((select auth.uid()) = user_id);
