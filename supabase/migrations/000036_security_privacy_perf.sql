-- =============================================================================
-- gamer_cred — 000036 security, privacy and performance fixes (audit 2026-11-04)
--
-- 1. SECURITY: the picture guard also covers new profile rows, and the unused
--    "owner insert" policy is gone (profiles are only made by handle_new_user).
-- 2. PRIVACY: blocking hides each player's friendships from the other (every
--    other player table already had a "hide blocked" rule).
-- 3. SECURITY: server-owned timestamps can't be set by the client, so nobody
--    can pin a review to the top of the feed or trending with a future date.
-- 4. PERF: the Community feed and Trending filter on published_at, which the
--    existing index covers, instead of scanning every published review.
-- 5. PERF: report lookups match ids with the primary key index (no id::text).
-- 6. PERF: the review browser's Popular sort reads a stored like count instead
--    of counting every like on every review (the counts stay private).
-- 7. PERF: smart_list_previews gives list cards their count + first covers in
--    one call, instead of each card downloading its whole smart list.
--
-- No existing column or row changes; one new private table, filled from
-- review_likes.
-- =============================================================================

-- ---- 1. picture guard on insert ------------------------------------------------------------
create or replace function public.profiles_guard_avatar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.avatar_url is not null
     and (tg_op = 'INSERT' or new.avatar_url is distinct from old.avatar_url)
     and current_user in ('authenticated', 'anon') then
    raise exception 'Profile pictures are set through the picture check.' using errcode = 'AV001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_avatar on public.profiles;
create trigger profiles_guard_avatar
  before insert or update of avatar_url on public.profiles
  for each row execute function public.profiles_guard_avatar();

-- The app never inserts profiles; handle_new_user (security definer) does.
drop policy if exists "profiles: owner insert" on public.profiles;

-- ---- 2. blocks hide friendships --------------------------------------------------------------
drop policy if exists "friendships: hide blocked" on public.friendships;
create policy "friendships: hide blocked" on public.friendships
  as restrictive for select to authenticated
  using (not (user_id = any ((select private.hidden_user_ids())::uuid[]))
         and not (friend_id = any ((select private.hidden_user_ids())::uuid[])));

-- ---- 3. server-owned timestamps --------------------------------------------------------------
-- Same as 000004, plus: created_at is set once, and a published review keeps
-- the published_at it got when it went public.
create or replace function public.reviews_set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_at = now();
  else
    new.created_at = old.created_at;
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = now();
  elsif new.status = 'published' then
    new.published_at = coalesce(old.published_at, now());
  elsif new.status = 'draft' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

-- Insert-time stamps (the update triggers already stamp updated_at).
create or replace function public.stamp_created_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = now();
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.stamp_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.stamp_created()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at = now();
  return new;
end;
$$;

drop trigger if exists game_ratings_stamp_insert on public.game_ratings;
create trigger game_ratings_stamp_insert
  before insert on public.game_ratings
  for each row execute function public.stamp_created_updated();

drop trigger if exists now_playing_stamp_insert on public.now_playing;
create trigger now_playing_stamp_insert
  before insert on public.now_playing
  for each row execute function public.stamp_updated();

drop trigger if exists game_likes_stamp_insert on public.game_likes;
create trigger game_likes_stamp_insert
  before insert on public.game_likes
  for each row execute function public.stamp_created();

-- Same as 000015, plus created_at can't be rewritten.
create or replace function public.game_ratings_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.created_at := old.created_at;
  return new;
end;
$$;

-- ---- 4. feed + trending use the published_at index -------------------------------------------
-- Same as 000029, except reviews are filtered and ordered by published_at (always
-- set on published rows, see 3.) and the Community / Friends review queries are
-- separate branches, so each one can use its own index.
create or replace function public.activity_feed(
  p_scope text default 'friends',
  p_before timestamptz default null,
  p_before_key text default null,
  p_limit integer default 20
)
returns table (
  item_key text,
  kind text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_avatar_url text,
  game_id bigint,
  review_id uuid,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  excerpt text,
  slot_index smallint,
  preliminary_score smallint,
  preliminary_input_scale public.rating_scale,
  preliminary_input text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select least(greatest(coalesce(p_limit, 20), 1), 50) as lim,
           coalesce(p_before_key, '') as before_key
  ),
  friends as (
    select case when f.user_id = auth.uid() then f.friend_id else f.user_id end as id
    from public.friendships f
    where f.status = 'accepted' and auth.uid() in (f.user_id, f.friend_id)
  ),
  review_items as (
    (
      select 'review:' || r.id::text as item_key,
             'review'::text as kind,
             r.published_at as occurred_at,
             r.user_id as actor_id,
             r.game_id,
             r.id as review_id,
             r.rating,
             r.rating_input_scale,
             r.rating_input,
             left(r.content, 280) as excerpt,
             null::smallint as slot_index,
             null::smallint as preliminary_score,
             null::public.rating_scale as preliminary_input_scale,
             null::text as preliminary_input
      from public.reviews r, params
      where p_scope = 'community'
        and r.status = 'published'
        and r.published_at <= coalesce(p_before, 'infinity'::timestamptz)
        and (p_before is null
             or (r.published_at, 'review:' || r.id::text) < (p_before, params.before_key))
      order by r.published_at desc, 1 desc
      limit (select lim from params)
    )
    union all
    (
      select 'review:' || r.id::text,
             'review'::text,
             r.published_at,
             r.user_id,
             r.game_id,
             r.id,
             r.rating,
             r.rating_input_scale,
             r.rating_input,
             left(r.content, 280),
             null::smallint,
             null::smallint,
             null::public.rating_scale,
             null::text
      from public.reviews r, params
      where p_scope = 'friends'
        and r.status = 'published'
        and r.user_id in (select id from friends)
        and r.published_at <= coalesce(p_before, 'infinity'::timestamptz)
        and (p_before is null
             or (r.published_at, 'review:' || r.id::text) < (p_before, params.before_key))
      order by r.published_at desc, 1 desc
      limit (select lim from params)
    )
  ),
  now_playing_items as (
    select 'now_playing:' || n.user_id::text || ':' || n.slot_index as item_key,
           'now_playing'::text as kind,
           n.updated_at as occurred_at,
           n.user_id as actor_id,
           n.game_id,
           null::uuid as review_id,
           null::smallint as rating,
           null::public.rating_scale as rating_input_scale,
           null::text as rating_input,
           left(n.notes, 280) as excerpt,
           n.slot_index,
           n.preliminary_score,
           n.preliminary_input_scale,
           n.preliminary_input
    from public.now_playing n, params
    where p_scope = 'friends'
      and n.user_id in (select id from friends)
      and (p_before is null
           or (n.updated_at, 'now_playing:' || n.user_id::text || ':' || n.slot_index) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  like_items as (
    select 'like:' || l.user_id::text || ':' || l.game_id as item_key,
           'like'::text as kind,
           l.created_at as occurred_at,
           l.user_id as actor_id,
           l.game_id,
           null::uuid as review_id,
           null::smallint as rating,
           null::public.rating_scale as rating_input_scale,
           null::text as rating_input,
           null::text as excerpt,
           null::smallint as slot_index,
           null::smallint as preliminary_score,
           null::public.rating_scale as preliminary_input_scale,
           null::text as preliminary_input
    from public.game_likes l, params
    where p_scope = 'friends'
      and l.user_id in (select id from friends)
      and (p_before is null
           or (l.created_at, 'like:' || l.user_id::text || ':' || l.game_id) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  merged as (
    select * from review_items
    union all
    select * from now_playing_items
    union all
    select * from like_items
  )
  select m.item_key, m.kind, m.occurred_at, m.actor_id,
         p.username, p.avatar_url,
         m.game_id, m.review_id, m.rating, m.rating_input_scale, m.rating_input,
         m.excerpt, m.slot_index, m.preliminary_score, m.preliminary_input_scale, m.preliminary_input
  from merged m
  join public.profiles p on p.id = m.actor_id
  order by m.occurred_at desc, m.item_key desc
  limit (select lim from params);
$$;

-- Same as 000020, except the time filters are plain comparisons the indexes can use.
create or replace function public.trending_games(p_days integer default 14, p_limit integer default 12)
returns table (game_id bigint, players integer, activity integer, average_rating numeric, last_activity timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90)) as since,
           least(greatest(coalesce(p_limit, 12), 1), 50) as lim
  ),
  activity as (
    select q.game_id, q.user_id, q.updated_at as at
    from public.game_ratings q
    where q.updated_at >= (select since from params)
    union all
    select r.game_id, r.user_id, r.published_at
    from public.reviews r
    where r.status = 'published' and r.published_at >= (select since from params)
  )
  select a.game_id,
         count(distinct a.user_id)::integer,
         count(*)::integer,
         (select round(avg(q.rating), 1) from public.game_ratings q where q.game_id = a.game_id),
         max(a.at)
  from activity a
  group by a.game_id
  order by count(distinct a.user_id) desc, count(*) desc, max(a.at) desc, a.game_id
  limit (select lim from params);
$$;

create or replace function public.trending_posts(p_days integer default 14, p_limit integer default 10)
returns table (
  item_key text,
  kind text,
  occurred_at timestamptz,
  actor_id uuid,
  actor_username text,
  actor_avatar_url text,
  game_id bigint,
  review_id uuid,
  rating smallint,
  rating_input_scale public.rating_scale,
  rating_input text,
  excerpt text,
  slot_index smallint,
  preliminary_score smallint,
  preliminary_input_scale public.rating_scale,
  preliminary_input text
)
language sql
stable
security invoker
set search_path = ''
as $$
  with params as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 90)) as since,
           least(greatest(coalesce(p_limit, 10), 1), 50) as lim
  ),
  hot as (
    select t.game_id, t.players, t.activity from public.trending_games(p_days, 50) t
  )
  select 'review:' || r.id::text, 'review'::text, r.published_at,
         r.user_id, p.username, p.avatar_url, r.game_id, r.id,
         r.rating, r.rating_input_scale, r.rating_input, left(r.content, 280),
         null::smallint, null::smallint, null::public.rating_scale, null::text
  from public.reviews r
  join hot h on h.game_id = r.game_id
  join public.profiles p on p.id = r.user_id
  where r.status = 'published' and r.published_at >= (select since from params)
  order by h.players desc, h.activity desc, r.published_at desc
  limit (select lim from params);
$$;

-- ---- 5. report lookups use the primary keys --------------------------------------------------
-- Text → uuid / bigint, or null when it isn't one (old malformed ids never raise).
-- No SET clause, so it inlines into the callers' plans.
create or replace function private.try_uuid(t text)
returns uuid
language sql
immutable
as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end;
$$;

create or replace function private.try_bigint(t text)
returns bigint
language sql
immutable
as $$
  select case when t ~ '^[0-9]{1,18}$' then t::bigint end;
$$;

revoke all on function private.try_uuid(text) from public, anon;
revoke all on function private.try_bigint(text) from public, anon;
grant execute on function private.try_uuid(text) to authenticated;
grant execute on function private.try_bigint(text) to authenticated;

-- Same as 000033.
create or replace function public.content_reports_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  case new.target_type
    when 'review' then
      select r.user_id into v_owner from public.reviews r where r.id = private.try_uuid(new.target_id) and r.status = 'published';
    when 'list' then
      select l.user_id into v_owner from public.lists l where l.id = private.try_uuid(new.target_id);
    when 'user' then
      select p.id into v_owner from public.profiles p where p.id = private.try_uuid(new.target_id);
    when 'rating' then
      -- target_id is the game; the rating must really be this player's.
      select q.user_id into v_owner from public.game_ratings q
       where q.game_id = private.try_bigint(new.target_id) and q.user_id = new.target_user_id;
  end case;
  if v_owner is null then
    raise exception 'That content no longer exists.' using errcode = 'SF007';
  end if;
  new.target_user_id := v_owner;
  return new;
end;
$$;

-- Same as 000033.
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
  if not (select public.is_app_admin()) then
    raise exception 'Only app admins can review reports.' using errcode = 'LS001';
  end if;
  return query
  select r.id, r.created_at, r.target_type, r.target_id, r.target_user_id,
         tu.username, ru.username, r.reason, r.details,
         case r.target_type
           when 'review' then (select left(coalesce(v.content, '(score only)'), 400) from public.reviews v where v.id = private.try_uuid(r.target_id))
           when 'list' then (select l.title || coalesce(' — ' || left(l.description, 300), '') from public.lists l where l.id = private.try_uuid(r.target_id))
           when 'rating' then (select 'Rated game #' || q.game_id || ': ' || q.rating || '/100' from public.game_ratings q
                               where q.user_id = r.target_user_id and q.game_id = private.try_bigint(r.target_id))
           when 'user' then tu.username
         end,
         case r.target_type
           when 'review' then exists (select 1 from public.reviews v where v.id = private.try_uuid(r.target_id))
           when 'list' then exists (select 1 from public.lists l where l.id = private.try_uuid(r.target_id))
           when 'rating' then exists (select 1 from public.game_ratings q where q.user_id = r.target_user_id and q.game_id = private.try_bigint(r.target_id))
           when 'user' then tu.id is not null
         end,
         r.status,
         (select count(*)::integer from public.content_reports o
           where o.target_type = r.target_type and o.target_id = r.target_id
             and o.target_user_id = r.target_user_id and o.status = 'open')
  from public.content_reports r
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.profiles ru on ru.id = r.reporter_id
  where r.status = p_status
  order by r.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Same as 000033.
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
      when 'review' then delete from public.reviews where id = private.try_uuid(p_target_id);
      when 'list' then delete from public.lists where id = private.try_uuid(p_target_id);
      when 'rating' then
        -- A published review needs its score: removing the rating removes that review too.
        delete from public.reviews where user_id = p_target_user and game_id = private.try_bigint(p_target_id);
        delete from public.game_ratings where user_id = p_target_user and game_id = private.try_bigint(p_target_id);
      when 'user' then
        raise exception 'Remove users with the account function (it deletes the sign-in too).' using errcode = 'SF004';
    end case;
  end if;
  update public.content_reports
     set status = case when p_remove then 'actioned'::public.report_status else 'dismissed'::public.report_status end,
         resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_note
   where target_type = p_target_type and target_id = p_target_id and status = 'open'
     -- A rating report is about one player's rating of the game, not every rating of it.
     and (p_target_type <> 'rating' or target_user_id = p_target_user);
  get diagnostics v_count = row_count;
  perform public.log_admin_action(
    case when p_remove then 'reports.remove' else 'reports.dismiss' end,
    p_target_type::text, p_target_id,
    jsonb_build_object('targetUser', p_target_user, 'reports', v_count, 'note', p_note));
  return v_count;
end;
$$;

-- ---- 6. stored like counts for the Popular sort ----------------------------------------------
-- Private (000030: counts are only shown to a review's author), so not a column
-- on public.reviews.
create table if not exists private.review_like_counts (
  review_id uuid primary key references public.reviews (id) on delete cascade,
  likes     integer not null default 0 check (likes >= 0)
);

alter table private.review_like_counts enable row level security;
revoke all on private.review_like_counts from public, anon, authenticated;

insert into private.review_like_counts (review_id, likes)
select l.review_id, count(*)::integer from public.review_likes l group by l.review_id
on conflict (review_id) do update set likes = excluded.likes;

create or replace function private.review_likes_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into private.review_like_counts (review_id, likes) values (new.review_id, 1)
    on conflict (review_id) do update set likes = private.review_like_counts.likes + 1;
  else
    -- The review may be going too (cascade): then there is no row to update.
    update private.review_like_counts set likes = greatest(likes - 1, 0) where review_id = old.review_id;
  end if;
  return null;
end;
$$;

revoke all on function private.review_likes_count() from public, anon, authenticated;

drop trigger if exists review_likes_count on public.review_likes;
create trigger review_likes_count
  after insert or delete on public.review_likes
  for each row execute function private.review_likes_count();

-- Same as 000032, except Popular reads the stored count.
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
    select r.*, coalesce(c.likes, 0) as likes
      from public.reviews r
      left join private.review_like_counts c on c.review_id = r.id
     where r.game_id = p_game_id
       and r.status = 'published'
       and not (r.user_id = any ((select private.hidden_user_ids())::uuid[]))
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

-- ---- 7. smart list card previews -------------------------------------------------------------
-- For list cards: each smart list's game count and first four game ids, from
-- the saved result (worked out now for a list that has none yet). Same
-- visibility as smart_list_games; blocked owners' lists are skipped.
create or replace function public.smart_list_previews(p_list_ids uuid[])
returns table (list_id uuid, game_count integer, preview_game_ids bigint[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_result jsonb;
begin
  for v_id in
    select l.id from public.lists l
     where l.id = any (p_list_ids[1:100])
       and l.smart_rule is not null
       and (l.is_public or l.user_id = (select auth.uid()))
       and not (l.user_id = any ((select private.hidden_user_ids())::uuid[]))
  loop
    select c.result into v_result from public.smart_list_cache c where c.list_id = v_id;
    if v_result is null then
      v_result := public.smart_list_refresh(v_id);
    end if;
    list_id := v_id;
    game_count := coalesce(jsonb_array_length(v_result -> 'games'), 0);
    preview_game_ids := array(
      select (g ->> 'gameId')::bigint
        from jsonb_array_elements(coalesce(v_result -> 'games', '[]'::jsonb)) with ordinality as e(g, n)
       order by e.n
       limit 4
    );
    return next;
  end loop;
end;
$$;

revoke execute on function public.smart_list_previews(uuid[]) from public, anon;
grant execute on function public.smart_list_previews(uuid[]) to authenticated;
