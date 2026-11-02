-- =============================================================================
-- gamer_cred — 000001 initial schema
-- Game / platform IDs are IGDB numeric IDs (bigint). Game metadata lives in
-- igdb_cache, which is written only by Edge Functions (service role).
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.friendship_status as enum ('pending', 'accepted', 'rejected');
create type public.review_status as enum ('draft', 'published');

-- -----------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null unique
              check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- friendships
-- -----------------------------------------------------------------------------
create table public.friendships (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,  -- requester
  friend_id   uuid not null references public.profiles (id) on delete cascade,  -- recipient
  status      public.friendship_status not null default 'pending',
  created_at  timestamptz not null default now(),
  constraint friendships_no_self check (user_id <> friend_id),
  constraint friendships_unique_pair unique (user_id, friend_id)
);

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     bigint not null,
  rating      numeric(3, 1) check (rating between 0 and 10),
  content     text check (char_length(content) <= 10000),
  status      public.review_status not null default 'draft',
  created_at  timestamptz not null default now(),
  constraint reviews_published_has_rating check (status = 'draft' or rating is not null)
);

-- -----------------------------------------------------------------------------
-- now_playing (4 slots per user)
-- -----------------------------------------------------------------------------
create table public.now_playing (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  slot_index         smallint not null check (slot_index between 1 and 4),
  game_id            bigint not null,
  notes              text check (char_length(notes) <= 10000),
  preliminary_score  numeric(3, 1) check (preliminary_score between 0 and 10),
  updated_at         timestamptz not null default now(),
  primary key (user_id, slot_index),
  constraint now_playing_unique_game unique (user_id, game_id)
);

create trigger now_playing_set_updated_at
  before update on public.now_playing
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- user_favorites (Top 4)
-- -----------------------------------------------------------------------------
create table public.user_favorites (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  game_id  bigint not null,
  rank     smallint not null check (rank between 1 and 4),
  primary key (user_id, rank),
  constraint user_favorites_unique_game unique (user_id, game_id)
);

-- -----------------------------------------------------------------------------
-- user_platforms (hardware roster)
-- -----------------------------------------------------------------------------
create table public.user_platforms (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  platform_id  bigint not null,
  is_main      boolean not null default false,
  pc_specs     text check (char_length(pc_specs) <= 2000),
  primary key (user_id, platform_id)
);

-- At most one "Main" platform per user.
create unique index uq_user_platforms_one_main
  on public.user_platforms (user_id) where is_main;

-- -----------------------------------------------------------------------------
-- igdb_cache (written by Edge Functions with the service role only)
-- -----------------------------------------------------------------------------
create table public.igdb_cache (
  cache_key   text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create trigger igdb_cache_set_updated_at
  before update on public.igdb_cache
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Indexes
-- =============================================================================
create index idx_friendships_user         on public.friendships (user_id, friend_id, status);
create index idx_friendships_friend       on public.friendships (friend_id, status);
create index idx_reviews_game_id          on public.reviews (game_id, created_at desc);
create index idx_reviews_user_id          on public.reviews (user_id, created_at desc);
create index idx_reviews_published_feed   on public.reviews (created_at desc) where status = 'published';
create index idx_now_playing_user         on public.now_playing (user_id);
create index idx_now_playing_game         on public.now_playing (game_id);
create index idx_user_favorites_user      on public.user_favorites (user_id);
create index idx_user_favorites_game      on public.user_favorites (game_id);
create index idx_user_platforms_user      on public.user_platforms (user_id);
create index idx_igdb_cache_updated       on public.igdb_cache (updated_at);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles        enable row level security;
alter table public.friendships     enable row level security;
alter table public.reviews         enable row level security;
alter table public.now_playing     enable row level security;
alter table public.user_favorites  enable row level security;
alter table public.user_platforms  enable row level security;
alter table public.igdb_cache      enable row level security;

-- ---- profiles ---------------------------------------------------------------
create policy "profiles: public read"
  on public.profiles for select using (true);
create policy "profiles: owner insert"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "profiles: owner update"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---- friendships ------------------------------------------------------------
-- Accepted friendships are public; pending/rejected are visible only to the two parties.
create policy "friendships: read accepted or own"
  on public.friendships for select
  using (
    status = 'accepted'
    or (select auth.uid()) in (user_id, friend_id)
  );
create policy "friendships: requester sends pending request"
  on public.friendships for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending');
create policy "friendships: recipient responds"
  on public.friendships for update to authenticated
  using ((select auth.uid()) = friend_id)
  with check ((select auth.uid()) = friend_id);
create policy "friendships: either party removes"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_id, friend_id));

-- ---- reviews ----------------------------------------------------------------
-- Published reviews are public; drafts are visible only to their author.
create policy "reviews: read published or own"
  on public.reviews for select
  using (status = 'published' or (select auth.uid()) = user_id);
create policy "reviews: owner insert"
  on public.reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "reviews: owner update"
  on public.reviews for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "reviews: owner delete"
  on public.reviews for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---- now_playing ------------------------------------------------------------
create policy "now_playing: public read"
  on public.now_playing for select using (true);
create policy "now_playing: owner insert"
  on public.now_playing for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "now_playing: owner update"
  on public.now_playing for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "now_playing: owner delete"
  on public.now_playing for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---- user_favorites ---------------------------------------------------------
create policy "user_favorites: public read"
  on public.user_favorites for select using (true);
create policy "user_favorites: owner insert"
  on public.user_favorites for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_favorites: owner update"
  on public.user_favorites for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_favorites: owner delete"
  on public.user_favorites for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---- user_platforms ---------------------------------------------------------
create policy "user_platforms: public read"
  on public.user_platforms for select using (true);
create policy "user_platforms: owner insert"
  on public.user_platforms for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "user_platforms: owner update"
  on public.user_platforms for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_platforms: owner delete"
  on public.user_platforms for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---- igdb_cache -------------------------------------------------------------
-- Public read. No insert/update/delete policies: only the service role
-- (Edge Functions, which bypass RLS) may write.
create policy "igdb_cache: public read"
  on public.igdb_cache for select using (true);
