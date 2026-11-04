-- =============================================================================
-- gamer_cred — 000028 smart lists update once a day
--
-- Smart lists (000023) were worked out live on every view. Now each list's
-- result is saved and refreshed nightly (pg_cron), so lists are cheap to open
-- and don't reshuffle with every new rating. A new list, or a changed rule, is
-- worked out on its first view.
-- =============================================================================

create table public.smart_list_cache (
  list_id     uuid primary key references public.lists (id) on delete cascade,
  result      jsonb not null,
  computed_at timestamptz not null default now()
);

-- No policies: read and written only through the functions below.
alter table public.smart_list_cache enable row level security;

-- The calculation itself (same rules as 000023), for a rule. Internal.
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

-- Saves a fresh result for one list (internal).
create or replace function public.smart_list_refresh(p_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule   jsonb;
  v_result jsonb;
begin
  select l.smart_rule into v_rule from public.lists l where l.id = p_list_id and l.smart_rule is not null;
  if v_rule is null then
    return null;
  end if;
  v_result := public.smart_list_compute(v_rule) || jsonb_build_object('computedAt', now());
  insert into public.smart_list_cache (list_id, result, computed_at)
  values (p_list_id, v_result, now())
  on conflict (list_id) do update set result = excluded.result, computed_at = excluded.computed_at;
  return v_result;
end;
$$;

revoke all on function public.smart_list_refresh(uuid) from public, anon, authenticated;

-- What the app calls: the saved result (worked out now if there isn't one yet).
-- Null when the list doesn't exist, isn't smart, or is someone else's private list.
create or replace function public.smart_list_games(p_list_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not exists (
    select 1 from public.lists l
     where l.id = p_list_id and l.smart_rule is not null and (l.is_public or l.user_id = (select auth.uid()))
  ) then
    return null;
  end if;
  select c.result into v_result from public.smart_list_cache c where c.list_id = p_list_id;
  return coalesce(v_result, public.smart_list_refresh(p_list_id));
end;
$$;

revoke execute on function public.smart_list_games(uuid) from public, anon;
grant execute on function public.smart_list_games(uuid) to authenticated;

-- Nightly: refresh every smart list.
create or replace function public.refresh_all_smart_lists()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  for v_id in select id from public.lists where smart_rule is not null loop
    perform public.smart_list_refresh(v_id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.refresh_all_smart_lists() from public, anon, authenticated;

-- A changed rule shows straight away: drop the saved result so the next view recalculates.
create or replace function public.smart_list_rule_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.smart_list_cache where list_id = new.id;
  return null;
end;
$$;

create trigger lists_smart_rule_changed
  after update of smart_rule on public.lists
  for each row when (new.smart_rule is distinct from old.smart_rule)
  execute function public.smart_list_rule_changed();

-- Every night at 05:07 UTC (about 1 a.m. US Eastern).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gamercred-refresh-smart-lists', '7 5 * * *', $c$select public.refresh_all_smart_lists()$c$);
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
