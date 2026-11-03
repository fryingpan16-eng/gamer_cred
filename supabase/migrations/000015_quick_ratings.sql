-- =============================================================================
-- gamer_cred — 000015 quick ratings (separate from reviews)
--
-- A quick rating is one private overall score per (user, game). It is never
-- posted anywhere and never creates a review. A full review (public text +
-- score) still lives only in public.reviews and is only created by the Review
-- Studio (src/services/reviews.ts → saveReview).
--
-- ONE SCORE PER GAME: a user's quick rating and the score on their review of
-- the same game are kept identical by two sync triggers.
--   * saving a review with a score  → sets the quick rating
--   * changing the quick rating     → updates the score on their review (if any)
--   * clearing the quick rating     → blocked while a PUBLISHED review exists
--                                     (published reviews need a score); a
--                                     draft's score is cleared with it
--   * deleting a review             → keeps the quick rating
--
-- Non-destructive: no existing column or row is altered or deleted. Existing
-- rated reviews are copied into game_ratings.
-- =============================================================================

-- ---- 1. table ---------------------------------------------------------------
-- Same rating triplet as reviews (migration 000007): canonical 1–100 score +
-- the scale it was entered in + the raw input. game_id is the curated IGDB id
-- (one canonical entry per game), the same id reviews and game pages use.
create table public.game_ratings (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  game_id            bigint not null,
  rating             smallint not null check (rating between 1 and 100),
  rating_input_scale public.rating_scale not null,
  rating_input       text not null check (char_length(rating_input) between 1 and 16),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- One quick rating per game per user. Also the index for the batched lookup
  -- `where user_id = $me and game_id = any($ids)` that search results use.
  constraint game_ratings_pkey primary key (user_id, game_id)
);

-- The public Gamer Cred average (aggregate per game).
create index idx_game_ratings_game_id on public.game_ratings (game_id);
-- "My ratings, newest first" (library / stats).
create index idx_game_ratings_user_updated on public.game_ratings (user_id, updated_at desc);

alter table public.game_ratings enable row level security;

-- Private to their owner. The only cross-user use is the aggregate in
-- game_review_stats (SECURITY DEFINER, returns counts/averages only).
create policy "game_ratings: owner read"
  on public.game_ratings for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "game_ratings: owner insert"
  on public.game_ratings for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "game_ratings: owner update"
  on public.game_ratings for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "game_ratings: owner delete"
  on public.game_ratings for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.game_ratings_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger game_ratings_touch
  before update on public.game_ratings
  for each row execute function public.game_ratings_touch();

-- ---- 2. backfill: every existing rated review becomes that user's rating ----
insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, created_at, updated_at)
select r.user_id, r.game_id, r.rating, r.rating_input_scale, r.rating_input, r.created_at, r.updated_at
from public.reviews r
where r.rating is not null
on conflict (user_id, game_id) do nothing;

-- ---- 3. one score per game: sync triggers -----------------------------------
-- Each side only writes when the value actually differs, so the pair of
-- triggers settles after one round trip instead of looping.

-- review saved with a score → quick rating follows.
create or replace function public.reviews_sync_game_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.rating is null then
    return null; -- an unscored draft leaves the quick rating alone
  end if;
  insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input)
  values (new.user_id, new.game_id, new.rating, new.rating_input_scale, new.rating_input)
  on conflict (user_id, game_id) do update
    set rating = excluded.rating,
        rating_input_scale = excluded.rating_input_scale,
        rating_input = excluded.rating_input
    where (public.game_ratings.rating, public.game_ratings.rating_input_scale, public.game_ratings.rating_input)
          is distinct from (excluded.rating, excluded.rating_input_scale, excluded.rating_input);
  return null;
end;
$$;

create trigger reviews_sync_game_rating
  after insert or update of rating, rating_input_scale, rating_input on public.reviews
  for each row execute function public.reviews_sync_game_rating();

-- quick rating set / changed → the score on the user's review of that game follows.
create or replace function public.game_ratings_sync_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.reviews r
     set rating = new.rating,
         rating_input_scale = new.rating_input_scale,
         rating_input = new.rating_input
   where r.user_id = new.user_id
     and r.game_id = new.game_id
     and (r.rating, r.rating_input_scale, r.rating_input)
         is distinct from (new.rating, new.rating_input_scale, new.rating_input);
  return null;
end;
$$;

create trigger game_ratings_sync_review
  after insert or update on public.game_ratings
  for each row execute function public.game_ratings_sync_review();

-- clearing a quick rating: refuse while a published review needs that score;
-- otherwise clear a draft's score with it. Cascaded deletes (account deletion,
-- trigger depth > 1) skip both, so deleting a profile is never blocked.
create or replace function public.game_ratings_before_clear()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (
    select 1 from public.reviews r
    where r.user_id = old.user_id and r.game_id = old.game_id and r.status = 'published'
  ) then
    raise exception 'This game has a published review, which needs a score.'
      using errcode = 'GR001',
            hint = 'Change the rating instead, or delete the review in the Review Studio first.';
  end if;
  update public.reviews r
     set rating = null, rating_input_scale = null, rating_input = null
   where r.user_id = old.user_id and r.game_id = old.game_id and r.status = 'draft' and r.rating is not null;
  return old;
end;
$$;

create trigger game_ratings_before_clear
  before delete on public.game_ratings
  for each row execute function public.game_ratings_before_clear();

-- ---- 4. Gamer Cred score: one score per user, reviews and quick ratings -----
-- game_ratings holds every user's score for a game (rated reviews are synced
-- into it), so the public average reads it. SECURITY DEFINER so it can count
-- other users' private ratings; it returns only the aggregate.
-- (review_count keeps its name for compatibility; it is the number of ratings.)
create or replace function public.game_review_stats(p_game_id bigint)
returns table (review_count integer, average_rating numeric, distribution integer[])
language sql
stable
security definer
set search_path = ''
as $$
  with scores as (
    select q.rating as score from public.game_ratings q where q.game_id = p_game_id
  )
  select
    count(*)::integer,
    round(avg(score), 1),
    array(select count(s2.score)::integer
            from generate_series(1, 100) as s(n)
            left join scores s2 on s2.score = s.n
           group by s.n order by s.n)
  from scores;
$$;

-- ---- 5. Stats: a game is "logged" with a review OR a quick rating ------------
-- One row per logged game for the caller: first logged time, the one overall
-- score, and the platform from the review (quick ratings have none → Unknown).
create or replace function public.my_logged_games()
returns table (game_id bigint, first_logged timestamptz, rating smallint, platform_id bigint)
language sql stable security invoker set search_path = ''
as $$
  with ids as (
    select s.game_id, min(s.created_at) as first_logged
    from (
      select r.game_id, r.created_at from public.reviews r where r.user_id = auth.uid()
      union all
      select q.game_id, q.created_at from public.game_ratings q where q.user_id = auth.uid()
    ) s
    group by s.game_id
  )
  select i.game_id, i.first_logged, coalesce(q.rating, r.rating), r.platform_id
  from ids i
  left join public.game_ratings q on q.user_id = auth.uid() and q.game_id = i.game_id
  left join public.reviews r on r.user_id = auth.uid() and r.game_id = i.game_id;
$$;

create or replace function public.stats_rating_histogram()
returns table (score smallint, games integer)
language sql stable security invoker set search_path = ''
as $$
  select l.rating, count(*)::integer
  from public.my_logged_games() l
  where l.rating is not null
  group by l.rating
  order by l.rating;
$$;

create or replace function public.stats_platforms()
returns table (platform_id bigint, games integer)
language sql stable security invoker set search_path = ''
as $$
  select l.platform_id, count(*)::integer
  from public.my_logged_games() l
  group by l.platform_id
  order by count(*) desc, l.platform_id nulls last;
$$;

create or replace function public.stats_developers(p_limit integer default null)
returns table (developer text, games integer, total_studios integer)
language sql stable security invoker set search_path = ''
as $$
  with logged as (
    select l.game_id, g.developers
    from public.my_logged_games() l
    left join public.games g on g.igdb_id = l.game_id
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

create or replace function public.stats_genres()
returns table (genre text, games integer, rated_games integer, average_rating numeric)
language sql stable security invoker set search_path = ''
as $$
  with logged as (
    select l.game_id, l.rating, g.genres
    from public.my_logged_games() l
    left join public.games g on g.igdb_id = l.game_id
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

create or replace function public.stats_vs_community(p_limit integer default 5)
returns jsonb
language sql stable security invoker set search_path = ''
as $$
  with compared as (
    select l.game_id, g.name, l.rating as mine, g.community_rating as community,
           (l.rating - g.community_rating) as diff
    from public.my_logged_games() l
    join public.games g on g.igdb_id = l.game_id
    where l.rating is not null and g.community_rating is not null
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

create or replace function public.stats_release_years()
returns table (release_year smallint, games integer)
language sql stable security invoker set search_path = ''
as $$
  select g.release_year, count(*)::integer
  from public.my_logged_games() l
  left join public.games g on g.igdb_id = l.game_id
  group by g.release_year
  order by g.release_year nulls last;
$$;

create or replace function public.stats_logged_over_time()
returns table (month date, games integer)
language sql stable security invoker set search_path = ''
as $$
  select date_trunc('month', l.first_logged)::date, count(*)::integer
  from public.my_logged_games() l
  group by 1
  order by 1;
$$;

grant execute on function public.my_logged_games() to authenticated;
revoke execute on function public.my_logged_games() from anon;
