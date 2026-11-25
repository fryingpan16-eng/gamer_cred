-- =============================================================================
-- gamer_cred — 000052 game library (2026-11-25)
--
-- 1. library_entries: the games a player OWNS, one row per game per platform
--    (the same game can be owned on several). Independent of ratings and of
--    the backlog: nothing here adds, removes or reads either. Optional format
--    ('physical' / 'digital'); `source` says where a row came from ('manual'
--    from the app; later imports such as 'steam' write it server-side).
-- 2. profiles.library_visibility: 'private' (default, only you) or 'public'
--    (signed-in players, minus blocked ones), like backlog_visibility (000035).
--    The whole library follows it: rows, counts and any stat built on this
--    table (stats must stay SECURITY INVOKER so RLS decides, never definer).
-- 3. Server-owned added_at; owner-only writes; guests read-only; an hourly
--    cap generous enough for adding a big collection by hand.
-- 4. Merged game ids (000042): saves on an old id land on the original, and a
--    merge moves library rows (once per player + platform).
-- 5. library_of(user): a player's library with what the Library page filters
--    and sorts on (title, release year, the platform's generation) and the
--    owner's quick rating. Security invoker: RLS applies.
-- =============================================================================

-- ---- 1-2. table + setting ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists library_visibility text not null default 'private'
  constraint profiles_library_visibility check (library_visibility in ('public', 'private'));

create table if not exists public.library_entries (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  game_id     bigint not null check (game_id > 0),
  -- IGDB platform id (src/constants/platforms.ts). GamerCred-only ids (< 0,
  -- e.g. PC Handheld) aren't release platforms, so they can't be owned on.
  platform_id bigint not null check (platform_id > 0),
  format      text check (format in ('physical', 'digital')),
  source      text check (source ~ '^[a-z][a-z0-9_]{0,31}$'),
  added_at    timestamptz not null default now(),
  primary key (user_id, game_id, platform_id)
);

comment on table public.library_entries is
  'Games a player owns, per platform (000052). Private unless profiles.library_visibility = public.';

-- The Library page: newest first, by platform, by format; merges + future per-game stats by game.
create index if not exists idx_library_entries_user_added on public.library_entries (user_id, added_at desc);
create index if not exists idx_library_entries_user_platform on public.library_entries (user_id, platform_id);
create index if not exists idx_library_entries_user_format on public.library_entries (user_id, format) where format is not null;
create index if not exists idx_library_entries_game on public.library_entries (game_id);

alter table public.library_entries enable row level security;

-- Yours always; someone else's only when they made it public.
drop policy if exists "library_entries: read" on public.library_entries;
create policy "library_entries: read" on public.library_entries
  for select to authenticated using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p where p.id = user_id and p.library_visibility = 'public')
  );
drop policy if exists "library_entries: hide blocked" on public.library_entries;
create policy "library_entries: hide blocked" on public.library_entries
  as restrictive for select to authenticated using (not (user_id = any ((select private.hidden_user_ids())::uuid[])));

drop policy if exists "library_entries: owner insert" on public.library_entries;
create policy "library_entries: owner insert" on public.library_entries
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "library_entries: owner update" on public.library_entries;
create policy "library_entries: owner update" on public.library_entries
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "library_entries: owner delete" on public.library_entries;
create policy "library_entries: owner delete" on public.library_entries
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "library_entries: members insert" on public.library_entries;
create policy "library_entries: members insert" on public.library_entries
  as restrictive for insert to authenticated with check (not (select public.is_guest()));
drop policy if exists "library_entries: members update" on public.library_entries;
create policy "library_entries: members update" on public.library_entries
  as restrictive for update to authenticated using (not (select public.is_guest()));
drop policy if exists "library_entries: members delete" on public.library_entries;
create policy "library_entries: members delete" on public.library_entries
  as restrictive for delete to authenticated using (not (select public.is_guest()));

-- ---- 3. server-owned time + hourly cap ------------------------------------------------------
create or replace function public.library_entries_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.added_at := now();
  else
    new.user_id := old.user_id;
    new.added_at := old.added_at;
  end if;
  return new;
end;
$$;

drop trigger if exists library_entries_stamp on public.library_entries;
create trigger library_entries_stamp
  before insert or update on public.library_entries
  for each row execute function public.library_entries_stamp();

drop trigger if exists library_entries_hourly_limit on public.library_entries;
create trigger library_entries_hourly_limit before insert on public.library_entries
  for each row execute function private.hourly_insert_limit(
    'user_id', 'library_insert', '1000', 'You''ve added a lot of games this hour. Try again in a bit.');

-- ---- 4. merged game ids ---------------------------------------------------------------------
drop trigger if exists a_redirect_merged_game on public.library_entries;
create trigger a_redirect_merged_game before insert or update of game_id on public.library_entries
  for each row execute function private.redirect_merged_game();

-- merge_game_version (000042) records the pair in game_merges before moving
-- rows; this moves library rows at the same moment. A copy the player already
-- owns on the original (same platform) is kept once.
create or replace function private.library_follow_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.library_entries d
   where d.game_id = new.from_id
     and exists (select 1 from public.library_entries k
                  where k.user_id = d.user_id and k.game_id = new.to_id and k.platform_id = d.platform_id);
  update public.library_entries set game_id = new.to_id where game_id = new.from_id;
  return null;
end;
$$;

revoke all on function private.library_follow_merge() from public, anon, authenticated;

drop trigger if exists game_merges_move_library on public.game_merges;
create trigger game_merges_move_library
  after insert or update of to_id on public.game_merges
  for each row execute function private.library_follow_merge();

-- ---- 5. the Library page --------------------------------------------------------------------
create or replace function public.library_of(p_user_id uuid)
returns table (
  game_id            bigint,
  platform_id        bigint,
  format             text,
  source             text,
  added_at           timestamptz,
  name               text,
  release_year       smallint,
  generation         text,
  rating             smallint,
  rating_input_scale public.rating_scale,
  rating_input       text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.game_id, e.platform_id, e.format, e.source, e.added_at,
         g.name, g.release_year, pg.generation,
         r.rating, r.rating_input_scale, r.rating_input
    from public.library_entries e
    left join public.games g on g.igdb_id = e.game_id
    left join public.platform_generations pg on pg.platform_id = e.platform_id
    left join public.game_ratings r on r.user_id = e.user_id and r.game_id = e.game_id
   where e.user_id = p_user_id
   order by e.added_at desc, e.game_id, e.platform_id;
$$;

revoke execute on function public.library_of(uuid) from public, anon;
grant execute on function public.library_of(uuid) to authenticated;
