-- =============================================================================
-- gamer_cred — 000029 game likes (♥)
--
-- A one-tap way to show interest in a game without rating or reviewing it.
--   - game_likes: one row per player per game. Public to signed-in players (minus
--     blocked players), owner-only writes, members only (no guests).
--   - Friends' likes appear in the Friends activity feed.
--   - Admin smart lists can rank by likes ("Most liked").
--   - Stats: your liked games by series, studio, genre and era.
--   - games.series (IGDB franchises), filled by the proxy from game pages and
--     backfilled here from cached game pages.
-- =============================================================================

-- ---- 1. likes -------------------------------------------------------------------------
create table public.game_likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Like counts per game, and a player's likes newest first.
create index idx_game_likes_game on public.game_likes (game_id);
create index idx_game_likes_user_created on public.game_likes (user_id, created_at desc);

alter table public.game_likes enable row level security;

create policy "game_likes: read" on public.game_likes
  for select to authenticated using (true);
create policy "game_likes: hide blocked" on public.game_likes
  as restrictive for select to authenticated using (not public.is_hidden_user(user_id));
create policy "game_likes: owner insert" on public.game_likes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "game_likes: owner delete" on public.game_likes
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "game_likes: members insert" on public.game_likes
  as restrictive for insert to authenticated with check (not public.is_guest());
create policy "game_likes: members delete" on public.game_likes
  as restrictive for delete to authenticated using (not public.is_guest());

-- ---- 2. series on games -----------------------------------------------------------------
alter table public.games add column series text[] not null default '{}';

update public.games g
   set series = coalesce(array(select jsonb_array_elements_text(d.franchises)), '{}')
  from (
    select distinct on ((c.data->'results'->0->>'id')::bigint)
           (c.data->'results'->0->>'id')::bigint as igdb_id,
           c.data->'results'->0->'franchises' as franchises
      from public.igdb_cache c
     where c.cache_key like 'game-detail:%'
       and jsonb_typeof(c.data->'results'->0->'franchises') = 'array'
     order by (c.data->'results'->0->>'id')::bigint, c.updated_at desc
  ) d
 where g.igdb_id = d.igdb_id;

-- ---- 3. friends' likes in the activity feed ---------------------------------------------
-- Same as 000007, plus like_items (Friends scope only).
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
    select 'review:' || r.id::text as item_key,
           'review'::text as kind,
           coalesce(r.published_at, r.created_at) as occurred_at,
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
    where r.status = 'published'
      and (p_scope = 'community' or r.user_id in (select id from friends))
      and (p_before is null
           or (coalesce(r.published_at, r.created_at), 'review:' || r.id::text) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
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

-- ---- 4. smart lists can rank by likes ----------------------------------------------------
-- Same as 000028, plus rule.rankBy = 'likes'.
create or replace function public.smart_list_compute(r jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_types    text[];
  v_tiers    text[];
  v_genres   text[];
  v_from     integer;
  v_to       integer;
  v_platform bigint;
  v_limit    integer;
  v_result   jsonb;
begin
  v_types := array(select jsonb_array_elements_text(case when jsonb_typeof(r->'entryTypes') = 'array' then r->'entryTypes' else '[]' end));
  if cardinality(v_types) = 0 then
    v_types := array['game'];
  end if;
  v_tiers := array(select jsonb_array_elements_text(case when jsonb_typeof(r->'tiers') = 'array' then r->'tiers' else '[]' end));
  v_genres := array(select jsonb_array_elements_text(case when jsonb_typeof(r->'genres') = 'array' then r->'genres' else '[]' end));
  v_from := case when jsonb_typeof(r->'yearFrom') = 'number' then (r->>'yearFrom')::integer end;
  v_to := case when jsonb_typeof(r->'yearTo') = 'number' then (r->>'yearTo')::integer end;
  v_platform := case when jsonb_typeof(r->'platformId') = 'number' then (r->>'platformId')::bigint end;
  v_limit := least(500, greatest(1, coalesce(case when jsonb_typeof(r->'limit') = 'number' then (r->>'limit')::integer end, 500)));

  -- "Most liked" lists (000029): ranked by how many players like the game. The tier
  -- filter uses the game's Gamer Cred average; the platform filter doesn't apply.
  if coalesce(r->>'rankBy', 'average') = 'likes' then
    with liked as (
      select l.game_id, count(*)::integer as likes from public.game_likes l group by l.game_id
    ),
    rated as (
      select q.game_id, avg(q.rating)::numeric as avg_rating, count(*)::integer as n from public.game_ratings q group by q.game_id
    ),
    typed as (
      select k.game_id, k.likes, rt.avg_rating, coalesce(rt.n, 0) as n,
             coalesce(g.entry_type, 'game') as etype, g.release_year, coalesce(g.genres, '{}') as genres
        from liked k
        left join rated rt on rt.game_id = k.game_id
        left join public.games g on g.igdb_id = k.game_id
    ),
    picked as (
      select t.game_id, t.likes, t.avg_rating, t.n
        from typed t
       where t.etype = any (v_types)
         and (cardinality(v_tiers) = 0
              or (t.avg_rating is not null and public.tier_label_for_score(round(t.avg_rating)::integer) = any (v_tiers)))
         and (v_from is null or t.release_year >= v_from)
         and (v_to is null or t.release_year <= v_to)
         and (cardinality(v_genres) = 0 or t.genres && v_genres)
       order by t.likes desc, t.avg_rating desc nulls last, t.game_id
       limit v_limit
    ),
    ranked as (
      select row_number() over (order by p.likes desc, p.avg_rating desc nulls last, p.game_id) as rnk, p.*
        from picked p
    )
    select jsonb_build_object(
      'requirements', '{}'::jsonb,
      'games', coalesce(
        (select jsonb_agg(jsonb_build_object('rank', k.rnk, 'gameId', k.game_id, 'likeCount', k.likes,
                                             'average', round(k.avg_rating, 1), 'ratingCount', k.n) order by k.rnk)
           from ranked k),
        '[]'::jsonb)
    ) into v_result;
    return v_result;
  end if;

  with per_game as (
    select q.game_id, avg(q.rating)::numeric as avg_rating, count(*)::integer as n
      from public.game_ratings q
     where v_platform is null or q.platform_id = v_platform
     group by q.game_id
  ),
  typed as (
    select p.game_id, p.avg_rating, p.n,
           coalesce(g.entry_type, 'game') as etype,
           g.release_year,
           coalesce(g.genres, '{}') as genres
      from per_game p
      left join public.games g on g.igdb_id = p.game_id
  ),
  -- The bar per entry type: 75th percentile of rating counts, at least 3.
  bars as (
    select t.etype, greatest(3, ceil(percentile_cont(0.75) within group (order by t.n)))::integer as need
      from typed t
     group by t.etype
  ),
  picked as (
    select t.game_id, t.avg_rating, t.n
      from typed t
      join bars b on b.etype = t.etype
     where t.etype = any (v_types)
       and t.n >= b.need
       and (cardinality(v_tiers) = 0 or public.tier_label_for_score(round(t.avg_rating)::integer) = any (v_tiers))
       and (v_from is null or t.release_year >= v_from)
       and (v_to is null or t.release_year <= v_to)
       and (cardinality(v_genres) = 0 or t.genres && v_genres)
     order by t.avg_rating desc, t.n desc, t.game_id
     limit v_limit
  ),
  ranked as (
    select row_number() over (order by p.avg_rating desc, p.n desc, p.game_id) as rnk, p.*
      from picked p
  )
  select jsonb_build_object(
    'requirements', coalesce(
      (select jsonb_object_agg(e, coalesce((select b.need from bars b where b.etype = e), 3)) from unnest(v_types) e),
      '{}'::jsonb),
    'games', coalesce(
      (select jsonb_agg(jsonb_build_object('rank', k.rnk, 'gameId', k.game_id, 'average', round(k.avg_rating, 1), 'ratingCount', k.n)
                        order by k.rnk)
         from ranked k),
      '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.smart_list_compute(jsonb) from public, anon, authenticated;

-- ---- 5. stats: your liked games broken down -----------------------------------------------
-- p_dimension: 'series' | 'studios' | 'genres' | 'era'. Games with several studios,
-- genres or series count toward each; missing data lands in 'Unknown'.
create or replace function public.stats_liked(p_dimension text, p_limit integer default null)
returns table (label text, games bigint, total_labels bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_dimension not in ('series', 'studios', 'genres', 'era') then
    raise exception 'Unknown breakdown: %', p_dimension using errcode = '22023';
  end if;
  return query
  with mine as (
    select l.game_id, g.series, g.developers, g.genres, g.release_year
      from public.game_likes l
      left join public.games g on g.igdb_id = l.game_id
     where l.user_id = (select auth.uid())
  ),
  labels as (
    select coalesce(
             case when p_dimension = 'era' then (m.release_year / 10 * 10)::text || 's' else s.v end,
             'Unknown') as label,
           m.game_id
      from mine m
      left join lateral unnest(
        case p_dimension when 'series' then m.series when 'studios' then m.developers when 'genres' then m.genres end
      ) as s(v) on true
  ),
  counted as (
    select x.label, count(distinct x.game_id) as games from labels x group by x.label
  )
  select c.label, c.games, (select count(*) from counted)
    from counted c
   order by c.games desc, c.label
   limit p_limit;
end;
$$;

grant execute on function public.stats_liked(text, integer) to authenticated;
revoke execute on function public.stats_liked(text, integer) from public, anon;
