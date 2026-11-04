-- =============================================================================
-- gamer_cred — 000035 backlog ("want to play")
--
-- game_backlog: games a player plans to play, newest first. Shown on the Now
-- Playing page (between Now Playing and Review Studio), in the Now Playing game
-- picker before you search, on game pages (+ Backlog) and on profiles.
-- profiles.backlog_visibility: 'public' (signed-in players, minus blocked ones)
-- or 'private' (only you). A game leaves the backlog when you RATE it (a quick
-- rating, or publishing a review — which always sets the rating). Starting it in
-- Now Playing does not remove it.
-- =============================================================================

alter table public.profiles
  add column backlog_visibility text not null default 'public'
  constraint profiles_backlog_visibility check (backlog_visibility in ('public', 'private'));

create table public.game_backlog (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

create index idx_game_backlog_user_created on public.game_backlog (user_id, created_at desc);

alter table public.game_backlog enable row level security;

-- Yours always; someone else's only when they made it public.
create policy "game_backlog: read" on public.game_backlog
  for select to authenticated using (
    (select auth.uid()) = user_id
    or exists (select 1 from public.profiles p where p.id = user_id and p.backlog_visibility = 'public')
  );
create policy "game_backlog: hide blocked" on public.game_backlog
  as restrictive for select to authenticated using (not (user_id = any ((select private.hidden_user_ids())::uuid[])));
create policy "game_backlog: owner insert" on public.game_backlog
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "game_backlog: owner delete" on public.game_backlog
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "game_backlog: members insert" on public.game_backlog
  as restrictive for insert to authenticated with check (not (select public.is_guest()));
create policy "game_backlog: members delete" on public.game_backlog
  as restrictive for delete to authenticated using (not (select public.is_guest()));

-- Rating a game (quick rating or a published review, which syncs into game_ratings)
-- takes it off your backlog.
create or replace function public.rating_leaves_backlog()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.game_backlog where user_id = new.user_id and game_id = new.game_id;
  return null;
end;
$$;

create trigger game_ratings_leave_backlog
  after insert on public.game_ratings
  for each row execute function public.rating_leaves_backlog();
