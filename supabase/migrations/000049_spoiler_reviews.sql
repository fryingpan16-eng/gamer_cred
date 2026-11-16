-- =============================================================================
-- gamer_cred — 000049 spoiler reviews (2026-11-11)
--
-- 1. reviews.has_spoilers: the author marks a review as containing spoilers.
--    Feeds and lists hide its text behind a "Contains spoilers" cover; the
--    review page shows it.
-- 2-3. game_reviews_browse, activity_feed and trending_posts return it
--    (same as 000040 otherwise).
-- =============================================================================

-- ---- 1. column --------------------------------------------------------------------------------
alter table public.reviews add column if not exists has_spoilers boolean not null default false;

-- ---- 2. a game's review browser (000040 + has_spoilers) -------------------------------------
drop function if exists public.game_reviews_browse(bigint, text, text, integer, integer);
create function public.game_reviews_browse(
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
  author_avatar_url text,
  is_replay boolean,
  has_spoilers boolean
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
  newest as (
    select distinct on (r.user_id) r.*
      from public.reviews r
     where r.game_id = p_game_id
       and r.status = 'published'
       and not (r.user_id = any ((select private.hidden_user_ids())::uuid[]))
       and (p_scope = 'community' or r.user_id in (select fid from friends))
     order by r.user_id, r.created_at desc, r.id desc
  ),
  picked as (
    select n.*, coalesce(c.likes, 0) as likes
      from newest n
      left join private.review_like_counts c on c.review_id = n.id
  )
  select p.id, p.user_id, p.game_id, p.rating, p.rating_input_scale, p.rating_input, p.content,
         p.platform_id, p.published_at, p.updated_at, pr.username, pr.avatar_url, p.is_replay,
         p.has_spoilers
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

grant execute on function public.game_reviews_browse(bigint, text, text, integer, integer) to authenticated;
revoke execute on function public.game_reviews_browse(bigint, text, text, integer, integer) from public, anon;

-- ---- 3. feed and trending posts (000040 + has_spoilers) ---------------------------------------
drop function if exists public.activity_feed(text, timestamptz, text, integer);
create function public.activity_feed(
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
  preliminary_input text,
  is_replay boolean,
  has_spoilers boolean
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
             null::text as preliminary_input,
             r.is_replay,
             r.has_spoilers
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
             null::text,
             r.is_replay,
             r.has_spoilers
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
           n.preliminary_input,
           false as is_replay,
           false as has_spoilers
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
           null::text as preliminary_input,
           false as is_replay,
           false as has_spoilers
    from public.game_likes l, params
    where p_scope = 'friends'
      and l.user_id in (select id from friends)
      and (p_before is null
           or (l.created_at, 'like:' || l.user_id::text || ':' || l.game_id) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  replay_items as (
    select 'replay:' || x.id::text as item_key,
           'replay'::text as kind,
           x.created_at as occurred_at,
           x.user_id as actor_id,
           x.game_id,
           null::uuid as review_id,
           null::smallint as rating,
           null::public.rating_scale as rating_input_scale,
           null::text as rating_input,
           null::text as excerpt,
           null::smallint as slot_index,
           null::smallint as preliminary_score,
           null::public.rating_scale as preliminary_input_scale,
           null::text as preliminary_input,
           true as is_replay,
           false as has_spoilers
    from public.game_replays x, params
    where p_scope = 'friends'
      and x.user_id in (select id from friends)
      and (p_before is null
           or (x.created_at, 'replay:' || x.id::text) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  merged as (
    select * from review_items
    union all
    select * from now_playing_items
    union all
    select * from like_items
    union all
    select * from replay_items
  )
  select m.item_key, m.kind, m.occurred_at, m.actor_id,
         p.username, p.avatar_url,
         m.game_id, m.review_id, m.rating, m.rating_input_scale, m.rating_input,
         m.excerpt, m.slot_index, m.preliminary_score, m.preliminary_input_scale, m.preliminary_input,
         m.is_replay, m.has_spoilers
  from merged m
  join public.profiles p on p.id = m.actor_id
  order by m.occurred_at desc, m.item_key desc
  limit (select lim from params);
$$;

grant execute on function public.activity_feed(text, timestamptz, text, integer) to authenticated;
revoke execute on function public.activity_feed(text, timestamptz, text, integer) from public, anon;


drop function if exists public.trending_posts(integer, integer);
create function public.trending_posts(p_days integer default 14, p_limit integer default 10)
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
  preliminary_input text,
  is_replay boolean,
  has_spoilers boolean
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
         null::smallint, null::smallint, null::public.rating_scale, null::text,
         r.is_replay, r.has_spoilers
  from public.reviews r
  join hot h on h.game_id = r.game_id
  join public.profiles p on p.id = r.user_id
  where r.status = 'published' and r.published_at >= (select since from params)
  order by h.players desc, h.activity desc, r.published_at desc
  limit (select lim from params);
$$;

grant execute on function public.trending_posts(integer, integer) to authenticated;
revoke execute on function public.trending_posts(integer, integer) from public, anon;
