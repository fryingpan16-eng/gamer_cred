-- =============================================================================
-- gamer_cred — 000020 trending (Home → Community)
--
-- "Trending" is measured from GamerCred activity in the last p_days days:
-- quick ratings set or changed, and reviews published. There are no likes or
-- comments yet, so a post trends when its GAME is trending.
--
-- trending_games: games ranked by how many different players rated or
--   reviewed them recently (then by total activity, then most recent).
-- trending_posts: recent published reviews ranked by their game's trend,
--   newest first within a game. Same row shape as activity_feed.
--
-- Read-only functions + one index; nothing existing changes.
-- =============================================================================

create index idx_game_ratings_updated on public.game_ratings (updated_at desc);

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
    from public.game_ratings q, params
    where q.updated_at >= params.since
    union all
    select r.game_id, r.user_id, coalesce(r.published_at, r.created_at)
    from public.reviews r, params
    where r.status = 'published' and coalesce(r.published_at, r.created_at) >= params.since
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
  select 'review:' || r.id::text, 'review'::text, coalesce(r.published_at, r.created_at),
         r.user_id, p.username, p.avatar_url, r.game_id, r.id,
         r.rating, r.rating_input_scale, r.rating_input, left(r.content, 280),
         null::smallint, null::smallint, null::public.rating_scale, null::text
  from public.reviews r
  join params on true
  join hot h on h.game_id = r.game_id
  join public.profiles p on p.id = r.user_id
  where r.status = 'published' and coalesce(r.published_at, r.created_at) >= params.since
  order by h.players desc, h.activity desc, coalesce(r.published_at, r.created_at) desc
  limit (select lim from params);
$$;

grant execute on function public.trending_games(integer, integer) to authenticated;
grant execute on function public.trending_posts(integer, integer) to authenticated;
revoke execute on function public.trending_games(integer, integer) from anon;
revoke execute on function public.trending_posts(integer, integer) from anon;
