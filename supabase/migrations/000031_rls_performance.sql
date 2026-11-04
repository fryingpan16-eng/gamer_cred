-- =============================================================================
-- gamer_cred — 000031 faster row rules (no behaviour change)
--
-- 1. "Hide blocked" rules checked every row with is_hidden_user(row author): one
--    small lookup PER ROW. They now compare against your hidden-player list,
--    worked out ONCE per request (my_hidden_user_ids, wrapped in a sub-select so
--    Postgres runs it a single time). Same result: blocked players are hidden
--    both ways.
-- 2. "Members only" and admin rules call is_guest() / is_app_admin() wrapped in a
--    sub-select, so each runs once per request instead of once per row
--    (Supabase's recommended pattern).
-- 3. Three duplicate indexes dropped: each repeated the start of its table's
--    primary key (user_id), so the primary key already serves those lookups.
-- =============================================================================

-- ---- 1. hidden players, once per request --------------------------------------------
-- Everyone you blocked or who blocked you; empty when signed out.
create or replace function public.my_hidden_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array(
    select case when b.blocker_id = auth.uid() then b.blocked_id else b.blocker_id end
      from public.user_blocks b
     where auth.uid() is not null and auth.uid() in (b.blocker_id, b.blocked_id)
  ), '{}');
$$;

grant execute on function public.my_hidden_user_ids() to authenticated;
revoke execute on function public.my_hidden_user_ids() from public, anon;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('game_likes', 'user_id'), ('game_ratings', 'user_id'), ('lists', 'user_id'), ('now_playing', 'user_id'),
      ('profiles', 'id'), ('reviews', 'user_id'), ('user_favorites', 'user_id'), ('user_platforms', 'user_id')
    ) as v(tbl, col)
  loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t.tbl and policyname = t.tbl || ': hide blocked') then
      execute format(
        'alter policy %I on public.%I using (not (%I = any ((select public.my_hidden_user_ids())::uuid[])))',
        t.tbl || ': hide blocked', t.tbl, t.col);
    end if;
  end loop;
end;
$$;

-- The review browser filtered the same way, row by row.
create or replace function public.game_reviews_browse(
  p_game_id bigint,
  p_scope text default 'community',
  p_sort text default 'recent',
  p_offset integer default 0,
  p_limit integer default 20
)
returns table (
  id uuid,
  user_id uuid,
  game_id bigint,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  content text,
  platform_id bigint,
  published_at timestamptz,
  updated_at timestamptz,
  author_username text,
  author_avatar_url text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_scope not in ('community', 'friends') then
    raise exception 'Unknown scope: %', p_scope using errcode = '22023';
  end if;
  if p_sort not in ('popular', 'recent', 'highest', 'lowest') then
    raise exception 'Unknown sort: %', p_sort using errcode = '22023';
  end if;

  return query
  with friends as (
    select case when f.user_id = (select auth.uid()) then f.friend_id else f.user_id end as fid
      from public.friendships f
     where f.status = 'accepted' and (select auth.uid()) in (f.user_id, f.friend_id)
  ),
  picked as (
    select r.*,
           (select count(*) from public.review_likes l where l.review_id = r.id) as likes
      from public.reviews r
     where r.game_id = p_game_id
       and r.status = 'published'
       and not (r.user_id = any ((select public.my_hidden_user_ids())::uuid[]))
       and (p_scope = 'community' or r.user_id in (select fid from friends))
  )
  select p.id, p.user_id, p.game_id, p.rating, p.rating_input_scale, p.rating_input, p.content,
         p.platform_id, p.published_at, p.updated_at, pr.username, pr.avatar_url
    from picked p
    join public.profiles pr on pr.id = p.user_id
   order by
     case when p_sort = 'popular' then p.likes end desc nulls last,
     case when p_sort = 'highest' then p.rating end desc nulls last,
     case when p_sort = 'lowest' then p.rating end asc nulls last,
     coalesce(p.published_at, p.updated_at) desc,
     p.id desc
   offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
end;
$$;

-- ---- 2. members-only and admin checks, once per request -----------------------------
do $$
declare
  p record;
  guest_free constant text := 'not (select public.is_guest())';
begin
  for p in
    select schemaname, tablename, policyname, cmd
      from pg_policies
     where schemaname in ('public', 'storage') and policyname like '%: members %'
  loop
    if p.cmd = 'INSERT' then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, guest_free);
    elsif p.cmd = 'UPDATE' then
      execute format('alter policy %I on %I.%I using (%s) with check (%s)', p.policyname, p.schemaname, p.tablename, guest_free, guest_free);
    else
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, guest_free);
    end if;
  end loop;
end;
$$;

alter policy "admin_actions: verified admins read" on public.admin_actions
  using ((select public.is_app_admin()));
alter policy "content_reports: reporter or admin read" on public.content_reports
  using ((select auth.uid()) = reporter_id or (select public.is_app_admin()));
alter policy "content_reports: admin update" on public.content_reports
  using ((select public.is_app_admin())) with check ((select public.is_app_admin()));

-- ---- 3. duplicate indexes ------------------------------------------------------------------
drop index if exists public.idx_now_playing_user;     -- now_playing_pkey (user_id, slot_index)
drop index if exists public.idx_user_favorites_user;  -- user_favorites_pkey (user_id, rank)
drop index if exists public.idx_user_platforms_user;  -- user_platforms_pkey (user_id, platform_id)
