-- =============================================================================
-- gamer_cred — 000021 safety: blocking, reporting, moderation, terms
--
-- Store requirements for apps with user-generated content (Apple App Review
-- 1.2, Google Play UGC policy): users can report content and block abusive
-- users, the developer can act on reports and remove content / users, and
-- users agree to terms with zero tolerance for objectionable content.
-- (Account deletion is the `account` Edge Function: deleting the auth user
-- cascades every table; this migration adds nothing for it.)
--
-- * user_blocks: blocking hides BOTH users from each other everywhere
--   (profiles, reviews, ratings, lists, Now Playing, favourites, platforms) via
--   RESTRICTIVE select policies, removes any friendship and stops new requests.
-- * content_reports: reports on reviews, lists, ratings and users; app admins
--   (000019) review and resolve them.
-- * terms_acceptances: which Terms / Community Guidelines version a user accepted.
--
-- New tables, functions and additional (restrictive) policies only; no existing
-- column, row or policy is changed.
-- =============================================================================

-- ---- 1. blocking ---------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_pkey primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index idx_user_blocks_blocked on public.user_blocks (blocked_id, blocker_id);

alter table public.user_blocks enable row level security;
-- You see (and manage) only the blocks you made; nobody learns who blocked them.
create policy "user_blocks: read own" on public.user_blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
create policy "user_blocks: owner delete" on public.user_blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);
-- Inserts go through block_user() (it also removes the friendship).

-- True when the viewer blocked p_user or p_user blocked the viewer.
create or replace function public.is_hidden_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and p_user is not null and p_user <> auth.uid() and exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p_user)
       or (b.blocker_id = p_user and b.blocked_id = auth.uid())
  );
$$;

grant execute on function public.is_hidden_user(uuid) to authenticated, anon;

-- Restrictive policies AND with the existing read policies.
create policy "profiles: hide blocked" on public.profiles as restrictive
  for select using (not public.is_hidden_user(id));
create policy "reviews: hide blocked" on public.reviews as restrictive
  for select using (not public.is_hidden_user(user_id));
create policy "game_ratings: hide blocked" on public.game_ratings as restrictive
  for select using (not public.is_hidden_user(user_id));
create policy "lists: hide blocked" on public.lists as restrictive
  for select using (not public.is_hidden_user(user_id));
create policy "now_playing: hide blocked" on public.now_playing as restrictive
  for select using (not public.is_hidden_user(user_id));
create policy "user_favorites: hide blocked" on public.user_favorites as restrictive
  for select using (not public.is_hidden_user(user_id));
create policy "user_platforms: hide blocked" on public.user_platforms as restrictive
  for select using (not public.is_hidden_user(user_id));

-- No friend requests between blocked users. SECURITY DEFINER: the requester
-- can't read a block made against them (user_blocks RLS), but it must still apply.
create or replace function public.friendships_block_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = new.user_id and b.blocked_id = new.friend_id)
       or (b.blocker_id = new.friend_id and b.blocked_id = new.user_id)
  ) then
    raise exception 'You can''t send a friend request to this player.' using errcode = 'SF001';
  end if;
  return new;
end;
$$;

create trigger friendships_block_guard
  before insert on public.friendships
  for each row execute function public.friendships_block_guard();

-- Block: record it and remove any friendship / pending request between the two.
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = 'SF002';
  end if;
  if p_user = auth.uid() then
    raise exception 'You can''t block yourself.' using errcode = 'SF003';
  end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user)
  on conflict do nothing;
  delete from public.friendships f
   where (f.user_id = auth.uid() and f.friend_id = p_user)
      or (f.user_id = p_user and f.friend_id = auth.uid());
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- Your blocked players (their profiles are hidden from you, so read them here).
create or replace function public.my_blocked_users()
returns table (user_id uuid, username text, avatar_url text, blocked_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.avatar_url, b.created_at
  from public.user_blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- Did the viewer block p_user? (Profiles show "Unblock" instead of "not found".)
create or replace function public.block_state(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user) then 'blocked_by_me'
    when exists (select 1 from public.user_blocks where blocker_id = p_user and blocked_id = auth.uid()) then 'blocked_me'
    else 'none'
  end;
$$;

-- ---- 2. reports ----------------------------------------------------------------
create type public.report_target as enum ('review', 'list', 'rating', 'user');
create type public.report_reason as enum ('spam', 'harassment', 'hate', 'sexual', 'violence', 'self_harm', 'impersonation', 'spoilers', 'other');
create type public.report_status as enum ('open', 'actioned', 'dismissed');

create table public.content_reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles (id) on delete set null,
  target_type     public.report_target not null,
  -- review / list id, the rated game id, or the user id.
  target_id       text not null check (char_length(target_id) between 1 and 64),
  -- Whose content it is (for blocking / removal); kept even if the content goes.
  target_user_id  uuid not null,
  reason          public.report_reason not null,
  details         text check (char_length(details) <= 1000),
  status          public.report_status not null default 'open',
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 1000)
);

create index idx_content_reports_status on public.content_reports (status, created_at);
create index idx_content_reports_target on public.content_reports (target_type, target_id);
-- One open report per reporter per item (stops report spam).
create unique index uq_content_reports_open on public.content_reports (reporter_id, target_type, target_id) where status = 'open';

alter table public.content_reports enable row level security;
create policy "content_reports: reporter insert" on public.content_reports
  for insert to authenticated
  with check ((select auth.uid()) = reporter_id and status = 'open' and resolved_at is null and resolved_by is null);
create policy "content_reports: reporter or admin read" on public.content_reports
  for select to authenticated using ((select auth.uid()) = reporter_id or public.is_app_admin());
create policy "content_reports: admin update" on public.content_reports
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

-- Admin queue: reports with who/what they are about and a preview of the content.
create or replace function public.admin_reports(p_status public.report_status default 'open', p_limit integer default 100)
returns table (
  id uuid,
  created_at timestamptz,
  target_type public.report_target,
  target_id text,
  target_user_id uuid,
  target_username text,
  reporter_username text,
  reason public.report_reason,
  details text,
  preview text,
  content_exists boolean,
  status public.report_status,
  open_reports_on_target integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can review reports.' using errcode = 'LS001';
  end if;
  return query
  select r.id, r.created_at, r.target_type, r.target_id, r.target_user_id,
         tu.username, ru.username, r.reason, r.details,
         case r.target_type
           when 'review' then (select left(coalesce(v.content, '(score only)'), 400) from public.reviews v where v.id::text = r.target_id)
           when 'list' then (select l.title || coalesce(' — ' || left(l.description, 300), '') from public.lists l where l.id::text = r.target_id)
           when 'rating' then (select 'Rated game #' || q.game_id || ': ' || q.rating || '/100' from public.game_ratings q
                               where q.user_id = r.target_user_id and q.game_id::text = r.target_id)
           when 'user' then tu.username
         end,
         case r.target_type
           when 'review' then exists (select 1 from public.reviews v where v.id::text = r.target_id)
           when 'list' then exists (select 1 from public.lists l where l.id::text = r.target_id)
           when 'rating' then exists (select 1 from public.game_ratings q where q.user_id = r.target_user_id and q.game_id::text = r.target_id)
           when 'user' then tu.id is not null
         end,
         r.status,
         (select count(*)::integer from public.content_reports o
           where o.target_type = r.target_type and o.target_id = r.target_id and o.status = 'open')
  from public.content_reports r
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.profiles ru on ru.id = r.reporter_id
  where r.status = p_status
  order by r.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Admin: resolve every open report on a target. p_remove deletes the content
-- (review, list or rating); user removal is the `account` Edge Function.
create or replace function public.admin_resolve_reports(
  p_target_type public.report_target,
  p_target_id text,
  p_target_user uuid,
  p_remove boolean,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can resolve reports.' using errcode = 'LS001';
  end if;
  if p_remove then
    case p_target_type
      when 'review' then delete from public.reviews where id::text = p_target_id;
      when 'list' then delete from public.lists where id::text = p_target_id;
      when 'rating' then
        -- A published review needs its score: removing the rating removes that review too.
        delete from public.reviews where user_id = p_target_user and game_id::text = p_target_id;
        delete from public.game_ratings where user_id = p_target_user and game_id::text = p_target_id;
      when 'user' then
        raise exception 'Remove users with the account function (it deletes the sign-in too).' using errcode = 'SF004';
    end case;
  end if;
  update public.content_reports
     set status = case when p_remove then 'actioned'::public.report_status else 'dismissed'::public.report_status end,
         resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_note
   where target_type = p_target_type and target_id = p_target_id and status = 'open';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---- 3. terms acceptance -------------------------------------------------------
create table public.terms_acceptances (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  version     text not null check (char_length(version) between 1 and 32),
  accepted_at timestamptz not null default now(),
  constraint terms_acceptances_pkey primary key (user_id, version)
);

alter table public.terms_acceptances enable row level security;
create policy "terms_acceptances: read own" on public.terms_acceptances
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "terms_acceptances: insert own" on public.terms_acceptances
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---- grants ----------------------------------------------------------------------
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocked_users() to authenticated;
grant execute on function public.block_state(uuid) to authenticated;
grant execute on function public.admin_reports(public.report_status, integer) to authenticated;
grant execute on function public.admin_resolve_reports(public.report_target, text, uuid, boolean, text) to authenticated;
revoke execute on function public.block_user(uuid) from anon;
revoke execute on function public.unblock_user(uuid) from anon;
revoke execute on function public.my_blocked_users() from anon;
revoke execute on function public.block_state(uuid) from anon;
revoke execute on function public.admin_reports(public.report_status, integer) from anon;
revoke execute on function public.admin_resolve_reports(public.report_target, text, uuid, boolean, text) from anon;
