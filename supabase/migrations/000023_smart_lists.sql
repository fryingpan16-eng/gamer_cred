-- =============================================================================
-- gamer_cred — 000023 smart lists (admin only)
--
-- A smart list stores a RULE instead of hand-picked games, e.g. "top 500
-- expansions by Gamer Cred average" or "every S-tier game". Its games are
-- worked out live from game_ratings each time it is opened.
--
-- Ranking: the plain Gamer Cred average (no weighting).
-- Qualifying: a game needs at least as many ratings as the 75th percentile of
-- rating counts among rated games of the SAME entry type (in the list's
-- platform scope), and never fewer than 3. The bar rises as the app grows.
--
-- Rule (lists.smart_rule, validated by the app's Zod schema; read defensively here):
--   { "entryTypes": ["game"],          -- game | expansion | dlc | remake | collection
--     "tiers": ["S"],                  -- tier labels of the rounded average; [] = any
--     "yearFrom": 2000, "yearTo": 2009, -- release year range; null = open
--     "genres": ["Role-playing (RPG)"], -- IGDB genre names, match any; [] = any
--     "platformId": 130,               -- only ratings played on this platform; null = all
--     "limit": 500 }                   -- 1–500
-- =============================================================================

alter table public.lists
  add column smart_rule jsonb
  constraint lists_smart_rule_object check (smart_rule is null or jsonb_typeof(smart_rule) = 'object');

-- Tier label for a 1–100 score. MIRRORS RATING_TIERS in src/constants/ratingRubric.ts
-- (S** = 100 shows as S). A test fails if the two disagree.
create or replace function public.tier_label_for_score(p_score integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_score >= 96 then 'S'
    when p_score >= 90 then 'A+'
    when p_score >= 80 then 'A'
    when p_score >= 70 then 'B'
    when p_score >= 60 then 'C'
    when p_score >= 50 then 'D'
    else 'F'
  end;
$$;

-- Same as 000019, plus: only admins may set or change a rule, and smart lists are always ranked.
create or replace function public.lists_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  if (tg_op = 'INSERT' and new.pinned_rank is not null)
     or (tg_op = 'UPDATE' and new.pinned_rank is distinct from old.pinned_rank) then
    if pg_trigger_depth() <= 1 and not public.is_app_admin() then
      raise exception 'Only app admins can pin lists to the Home tab.' using errcode = 'LS001';
    end if;
  end if;
  if (tg_op = 'INSERT' and new.smart_rule is not null)
     or (tg_op = 'UPDATE' and new.smart_rule is distinct from old.smart_rule) then
    if not public.is_app_admin() then
      raise exception 'Only app admins can make smart lists.' using errcode = 'LS005';
    end if;
  end if;
  if new.smart_rule is not null then
    new.is_ranked := true;
  end if;
  return new;
end;
$$;

-- Smart lists have no hand-picked games.
create or replace function public.list_items_block_smart()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.lists l where l.id = new.list_id and l.smart_rule is not null) then
    raise exception 'Smart lists fill themselves; games can''t be added by hand.' using errcode = 'LS006';
  end if;
  return new;
end;
$$;

create trigger list_items_block_smart
  before insert on public.list_items
  for each row execute function public.list_items_block_smart();

-- The games on a smart list, live. Returns
--   { "requirements": { "<entry type>": <min ratings>, … },
--     "games": [ { "rank", "gameId", "average", "ratingCount" }, … ] }
-- or null when the list doesn't exist, isn't smart, or is someone else's private list.
-- SECURITY DEFINER for the cross-user aggregate; only averages and counts leave it.
create or replace function public.smart_list_games(p_list_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r          jsonb;
  v_types    text[];
  v_tiers    text[];
  v_genres   text[];
  v_from     integer;
  v_to       integer;
  v_platform bigint;
  v_limit    integer;
  v_result   jsonb;
begin
  select l.smart_rule into r
    from public.lists l
   where l.id = p_list_id
     and l.smart_rule is not null
     and (l.is_public or l.user_id = (select auth.uid()));
  if r is null then
    return null;
  end if;

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

revoke execute on function public.smart_list_games(uuid) from public, anon;
grant execute on function public.smart_list_games(uuid) to authenticated;
