-- =============================================================================
-- gamer_cred — 000014 game metadata table + Stats aggregation functions
--
-- 1. public.games: a durable copy of the IGDB metadata the Stats page needs
--    (igdb_cache is a disposable, versioned cache). The igdb-proxy Edge Function
--    upserts a row whenever it caches a game; this migration backfills it from
--    the game records already cached.
-- 2. stats_* functions: every aggregate is computed in Postgres. SECURITY
--    INVOKER + an explicit `user_id = auth.uid()` filter, so a user only ever
--    aggregates their own reviews (RLS applies on top).
--
-- "Logged" = every game with a review by the user (draft or published).
-- Missing metadata lands in an 'Unknown' bucket; games with several developers
-- or genres count toward each one.
-- =============================================================================

-- ---- 1. games ---------------------------------------------------------------
create table public.games (
  igdb_id          bigint primary key,
  name             text not null,
  release_year     smallint,
  community_rating smallint check (community_rating between 0 and 100), -- IGDB total_rating
  genres           text[] not null default '{}',
  developers       text[] not null default '{}',
  entry_type       text,
  updated_at       timestamptz not null default now()
);

alter table public.games enable row level security;

-- IGDB metadata is public; only the Edge Function (service role) writes.
create policy "games: public read" on public.games for select using (true);

-- Backfill from cached per-game records (newest record per game wins).
insert into public.games (igdb_id, name, release_year, community_rating, genres, developers, entry_type, updated_at)
select distinct on ((g->>'id')::bigint)
       (g->>'id')::bigint,
       g->>'name',
       nullif(g->>'releaseYear', '')::smallint,
       nullif(g->>'rating', '')::smallint,
       coalesce(array(select jsonb_array_elements_text(coalesce(g->'genres', '[]'::jsonb))), '{}'),
       coalesce(array(select jsonb_array_elements_text(coalesce(g->'developers', '[]'::jsonb))), '{}'),
       g->>'entryType',
       c.updated_at
from public.igdb_cache c,
     lateral (select c.data->'results'->0 as g) r
where c.cache_key like 'game:%'
  and jsonb_typeof(c.data->'results') = 'array'
  and g ? 'id' and g ? 'name'
order by (g->>'id')::bigint, c.updated_at desc
on conflict (igdb_id) do nothing;

-- ---- 2. Stats ---------------------------------------------------------------

-- Score histogram (1–100) of the user's rated games. The app derives the tier /
-- star / rounded distributions and averages from it with the single TS rubric.
create or replace function public.stats_rating_histogram()
returns table (score smallint, games integer)
language sql stable security invoker set search_path = ''
as $$
  select r.rating, count(*)::integer
  from public.reviews r
  where r.user_id = auth.uid() and r.rating is not null
  group by r.rating
  order by r.rating;
$$;

-- Games per "played on" platform (null = Unknown).
create or replace function public.stats_platforms()
returns table (platform_id bigint, games integer)
language sql stable security invoker set search_path = ''
as $$
  select r.platform_id, count(*)::integer
  from public.reviews r
  where r.user_id = auth.uid()
  group by r.platform_id
  order by count(*) desc, r.platform_id nulls last;
$$;

-- Games per developer. p_limit = null returns every studio; total_studios is
-- always the full count (for the "Show all" toggle).
create or replace function public.stats_developers(p_limit integer default null)
returns table (developer text, games integer, total_studios integer)
language sql stable security invoker set search_path = ''
as $$
  with logged as (
    select r.game_id, g.developers
    from public.reviews r
    left join public.games g on g.igdb_id = r.game_id
    where r.user_id = auth.uid()
  ),
  per_dev as (
    select d.developer, count(distinct l.game_id)::integer as games
    from logged l
    cross join lateral unnest(
      case when coalesce(cardinality(l.developers), 0) = 0 then array['Unknown'] else l.developers end
    ) as d(developer)
    group by d.developer
  )
  select developer, games, (count(*) over ())::integer
  from per_dev
  order by games desc, developer
  limit p_limit;
$$;

-- Games and average rating per genre.
create or replace function public.stats_genres()
returns table (genre text, games integer, rated_games integer, average_rating numeric)
language sql stable security invoker set search_path = ''
as $$
  with logged as (
    select r.game_id, r.rating, g.genres
    from public.reviews r
    left join public.games g on g.igdb_id = r.game_id
    where r.user_id = auth.uid()
  )
  select x.genre,
         count(distinct l.game_id)::integer,
         count(l.rating)::integer,
         round(avg(l.rating), 1)
  from logged l
  cross join lateral unnest(
    case when coalesce(cardinality(l.genres), 0) = 0 then array['Unknown'] else l.genres end
  ) as x(genre)
  group by x.genre
  order by count(distinct l.game_id) desc, x.genre;
$$;

-- My rating vs IGDB's community rating (both 0–100): overall averages plus the
-- biggest disagreements in each direction ("hot takes").
create or replace function public.stats_vs_community(p_limit integer default 5)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with compared as (
    select r.game_id, g.name, r.rating as mine, g.community_rating as community,
           (r.rating - g.community_rating) as diff
    from public.reviews r
    join public.games g on g.igdb_id = r.game_id
    where r.user_id = auth.uid() and r.rating is not null and g.community_rating is not null
  )
  select jsonb_build_object(
    'compared', (select count(*) from compared),
    'my_average', (select round(avg(mine), 1) from compared),
    'community_average', (select round(avg(community), 1) from compared),
    'higher', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.diff desc)
      from (select * from compared where diff > 0 order by diff desc, name limit p_limit) t
    ), '[]'::jsonb),
    'lower', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.diff asc)
      from (select * from compared where diff < 0 order by diff asc, name limit p_limit) t
    ), '[]'::jsonb)
  );
$$;

-- Games per release year (null = Unknown). The app groups years into decades.
create or replace function public.stats_release_years()
returns table (release_year smallint, games integer)
language sql stable security invoker set search_path = ''
as $$
  select g.release_year, count(*)::integer
  from public.reviews r
  left join public.games g on g.igdb_id = r.game_id
  where r.user_id = auth.uid()
  group by g.release_year
  order by g.release_year nulls last;
$$;

-- Games logged per month (when the review was first created).
create or replace function public.stats_logged_over_time()
returns table (month date, games integer)
language sql stable security invoker set search_path = ''
as $$
  select date_trunc('month', r.created_at)::date, count(*)::integer
  from public.reviews r
  where r.user_id = auth.uid()
  group by 1
  order by 1;
$$;

grant execute on function
  public.stats_rating_histogram(),
  public.stats_platforms(),
  public.stats_developers(integer),
  public.stats_genres(),
  public.stats_vs_community(integer),
  public.stats_release_years(),
  public.stats_logged_over_time()
to authenticated;

revoke execute on function
  public.stats_rating_histogram(),
  public.stats_platforms(),
  public.stats_developers(integer),
  public.stats_genres(),
  public.stats_vs_community(integer),
  public.stats_release_years(),
  public.stats_logged_over_time()
from anon;
