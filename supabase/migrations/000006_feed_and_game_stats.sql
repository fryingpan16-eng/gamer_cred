-- =============================================================================
-- gamer_cred — 000006 activity feed & game review stats
--
-- Both functions are SECURITY INVOKER: RLS still applies (only published
-- reviews are visible; now_playing/profiles are public) and auth.uid()
-- identifies the viewer.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Community score for a game page: count, average and a 1–10 histogram.
-- -----------------------------------------------------------------------------
create or replace function public.game_review_stats(p_game_id bigint)
returns table (review_count integer, average_rating numeric, distribution integer[])
language sql
stable
security invoker
set search_path = ''
as $$
  with published as (
    select round(r.rating)::int as score
    from public.reviews r
    where r.game_id = p_game_id and r.status = 'published' and r.rating is not null
  )
  select
    count(*)::integer,
    round(avg(score), 1),
    array(select count(p.score)::integer
            from generate_series(1, 10) as s(n)
            left join published p on p.score = s.n
           group by s.n order by s.n)
  from published;
$$;

-- -----------------------------------------------------------------------------
-- Activity feed with keyset pagination.
--   p_scope 'friends'   → accepted friends' published reviews + Now Playing slots
--   p_scope 'community' → everyone's published reviews
-- Page with the last row's (occurred_at, item_key) as (p_before, p_before_key).
-- Each branch is ordered + limited before the union, so only the top
-- p_limit rows per source are ever sorted.
-- -----------------------------------------------------------------------------
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
  rating numeric,
  excerpt text,
  slot_index smallint,
  preliminary_score numeric
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
           left(r.content, 280) as excerpt,
           null::smallint as slot_index,
           null::numeric as preliminary_score
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
           null::numeric as rating,
           left(n.notes, 280) as excerpt,
           n.slot_index,
           n.preliminary_score
    from public.now_playing n, params
    where p_scope = 'friends'
      and n.user_id in (select id from friends)
      and (p_before is null
           or (n.updated_at, 'now_playing:' || n.user_id::text || ':' || n.slot_index) < (p_before, params.before_key))
    order by 3 desc, 1 desc
    limit (select lim from params)
  ),
  merged as (
    select * from review_items
    union all
    select * from now_playing_items
  )
  select m.item_key, m.kind, m.occurred_at, m.actor_id,
         p.username, p.avatar_url,
         m.game_id, m.review_id, m.rating, m.excerpt, m.slot_index, m.preliminary_score
  from merged m
  join public.profiles p on p.id = m.actor_id
  order by m.occurred_at desc, m.item_key desc
  limit (select lim from params);
$$;

create index if not exists idx_now_playing_updated on public.now_playing (updated_at desc);

grant execute on function public.game_review_stats(bigint) to anon, authenticated;
grant execute on function public.activity_feed(text, timestamptz, text, integer) to authenticated;
revoke execute on function public.activity_feed(text, timestamptz, text, integer) from anon;
