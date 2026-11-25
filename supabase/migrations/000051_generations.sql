-- =============================================================================
-- gamer_cred — 000051 console generations (2026-11-24)
--
-- 1. platform_generations: IGDB platform id → badge group ('1'–'9' = console
--    generation, or 'pc' / 'arcade' / 'mobile'). Old home computers and browser
--    games count as PC; the Switch is Gen 8. Unlisted platforms (VR headsets,
--    streaming services…) are skipped. Changing a platform's group is one row
--    here: every badge, list and stat follows (lists on their next refresh).
-- 2. games: the release facts the group is worked out from (igdb-proxy writes
--    them; backfilled from igdb_cache below).
-- 3. platform_group_of(): a game's group = its launch platforms' group (a
--    console beats PC / arcade / mobile, the oldest console wins); with none
--    listed, the first listed platform in release order. Remasters are folded
--    into their original, so they show the original's group; a remake is its
--    own entry and shows its own.
-- 4. Smart list rules gain "generation"; the guard below seeds one
--    "Top 250" list per group, owned by the app owner (000050).
-- 5. game_generation_badge(): everything the game page badge shows.
-- 6. stats_generations(): your logged games per group (two Stats views).
-- =============================================================================

-- ---- 1. platforms → groups ------------------------------------------------------------------
create table if not exists public.platform_generations (
  platform_id bigint primary key,
  generation  text not null check (generation in ('1', '2', '3', '4', '5', '6', '7', '8', '9', 'pc', 'arcade', 'mobile'))
);

alter table public.platform_generations enable row level security;

drop policy if exists "platform_generations: read" on public.platform_generations;
create policy "platform_generations: read" on public.platform_generations
  for select to authenticated using (true);

-- IGDB platform ids. Ids beyond src/constants/platforms.ts: check them with
-- supabase/functions/igdb-proxy/tools/platform-generations-verify.mjs.
insert into public.platform_generations (platform_id, generation) values
  -- 1st (1972–1983): Odyssey, Pong consoles (dedicated chips)
  (88, '1'), (140, '1'), (141, '1'), (142, '1'), (143, '1'), (144, '1'), (145, '1'), (146, '1'), (147, '1'), (148, '1'),
  -- 2nd (1976–1992): Channel F, 2600, 5200, Intellivision, Odyssey², ColecoVision, Vectrex, Microvision, Game & Watch, Astrocade, VC 4000, 1292 APVS
  (127, '2'), (59, '2'), (66, '2'), (67, '2'), (133, '2'), (68, '2'), (70, '2'), (89, '2'), (307, '2'), (91, '2'), (138, '2'), (139, '2'),
  -- 3rd (1983–2003): NES, Famicom, Famicom Disk System, Master System, 7800, SG-1000
  (18, '3'), (99, '3'), (51, '3'), (64, '3'), (60, '3'), (84, '3'),
  -- 4th (1987–2004): TurboGrafx-16 (+CD, SuperGrafx), Genesis (+Sega CD, 32X), Neo Geo AES/CD, SNES, Super Famicom, Satellaview, Game Boy, Lynx, Game Gear, CD-i
  (86, '4'), (150, '4'), (128, '4'), (29, '4'), (78, '4'), (30, '4'), (80, '4'), (136, '4'), (19, '4'), (58, '4'), (306, '4'),
  (33, '4'), (61, '4'), (35, '4'), (117, '4'),
  -- 5th (1993–2006): 3DO, Jaguar (+CD), Saturn, PlayStation, N64 (+64DD), Virtual Boy, Game Boy Color, Neo Geo Pocket (+Color), WonderSwan (+Color), Amiga CD32
  (50, '5'), (62, '5'), (410, '5'), (32, '5'), (7, '5'), (4, '5'), (416, '5'), (87, '5'), (22, '5'), (119, '5'), (120, '5'),
  (57, '5'), (123, '5'), (114, '5'),
  -- 6th (1998–2013): Dreamcast, PS2, GameCube, Xbox, Game Boy Advance, N-Gage, Pokémon mini, Nuon
  (23, '6'), (8, '6'), (21, '6'), (11, '6'), (24, '6'), (42, '6'), (166, '6'), (122, '6'),
  -- 7th (2005–2017): Xbox 360, PS3, Wii, DS, DSi, PSP
  (12, '7'), (9, '7'), (5, '7'), (20, '7'), (159, '7'), (38, '7'),
  -- 8th (2012–2020s): Wii U, PS4, Xbox One, 3DS, New 3DS, Vita, Switch
  (41, '8'), (48, '8'), (49, '8'), (37, '8'), (137, '8'), (46, '8'), (130, '8'),
  -- 9th (2020–present): PS5, Xbox Series X|S, Switch 2
  (167, '9'), (169, '9'), (508, '9'),
  -- PC: Windows, Mac, Linux, DOS, old home computers, web browser
  (6, 'pc'), (14, 'pc'), (3, 'pc'), (13, 'pc'), (16, 'pc'), (15, 'pc'), (75, 'pc'), (115, 'pc'), (26, 'pc'), (25, 'pc'),
  (27, 'pc'), (53, 'pc'), (63, 'pc'), (65, 'pc'), (69, 'pc'), (71, 'pc'), (82, 'pc'), (149, 'pc'), (121, 'pc'), (125, 'pc'),
  (118, 'pc'), (116, 'pc'), (134, 'pc'), (126, 'pc'), (151, 'pc'), (129, 'pc'), (152, 'pc'), (77, 'pc'), (90, 'pc'), (93, 'pc'),
  (94, 'pc'), (158, 'pc'),
  -- Mobile: iOS, Android, older phones, BlackBerry, Windows Phone
  (39, 'mobile'), (34, 'mobile'), (55, 'mobile'), (73, 'mobile'), (74, 'mobile'),
  -- Arcade: arcade boards, Neo Geo MVS, Hyper Neo Geo 64
  (52, 'arcade'), (79, 'arcade'), (135, 'arcade')
on conflict (platform_id) do update set generation = excluded.generation;

-- Order of the groups: consoles oldest first, then PC, arcade, mobile. Also the
-- tie-break for a launch on several platforms (lowest wins).
create or replace function public.platform_group_sort(p_group text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_group ~ '^[1-9]$' then p_group::integer
    when p_group = 'pc' then 10
    when p_group = 'arcade' then 11
    when p_group = 'mobile' then 12
    else 99
  end;
$$;

-- ---- 2. release facts on games ----------------------------------------------------------------
alter table public.games
  add column if not exists release_platform_ids   bigint[] not null default '{}', -- IGDB release order, earliest first
  add column if not exists launch_platform_ids    bigint[] not null default '{}', -- released within 90 days of the first
  add column if not exists remake_of              bigint,                         -- remakes: the game they remake
  add column if not exists remake_of_platform_ids bigint[] not null default '{}', -- remakes: that game's launch platforms
  add column if not exists remaster_platform_ids  bigint[] not null default '{}'; -- platforms of this game's remasters

-- Backfill from the per-game records already cached (no IGDB calls). Their
-- launch platforms aren't cached, so the first platform stands in (a game out
-- on PC a day before its consoles reads as PC for now). Using the
-- whole release list would be worse: it turns old PC games with late console
-- ports into console games. igdb-proxy refetches these records on their next
-- lookup (no launchPlatformIds yet), and remake / remaster notes fill in on the
-- next game page view.
update public.games g
   set release_platform_ids = x.ids,
       launch_platform_ids = x.ids[1:1],
       remake_of = x.remake_of
  from (
    select distinct on ((r.g ->> 'id')::bigint)
           (r.g ->> 'id')::bigint as id,
           array(select private.try_bigint(e) from jsonb_array_elements_text(r.g -> 'releasePlatformIds') e
                  where private.try_bigint(e) is not null) as ids,
           case when r.g ->> 'entryType' = 'remake' then private.try_bigint(r.g -> 'parentGame' ->> 'id') end as remake_of
      from public.igdb_cache c,
           lateral (select c.data -> 'results' -> 0 as g) r
     where c.cache_key like 'game:%'
       and jsonb_typeof(r.g -> 'releasePlatformIds') = 'array'
       and r.g ? 'id'
     order by (r.g ->> 'id')::bigint, c.updated_at desc
  ) x
 where g.igdb_id = x.id
   and cardinality(g.release_platform_ids) = 0;

-- ---- 3. a game's group ------------------------------------------------------------------------
create or replace function public.platform_group_of(p_launch bigint[], p_release bigint[])
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select pg.generation
       from unnest(coalesce(p_launch, '{}'::bigint[])) l(id)
       join public.platform_generations pg on pg.platform_id = l.id
      order by public.platform_group_sort(pg.generation)
      limit 1),
    (select pg.generation
       from unnest(coalesce(p_release, '{}'::bigint[])) with ordinality r(id, n)
       join public.platform_generations pg on pg.platform_id = r.id
      order by r.n
      limit 1)
  );
$$;

revoke execute on function public.platform_group_of(bigint[], bigint[]) from public, anon;
grant execute on function public.platform_group_of(bigint[], bigint[]) to authenticated;

-- ---- 4. smart lists by generation -------------------------------------------------------------
-- Same as 000029, plus rule.generation ('1'–'9', 'pc', 'arcade', 'mobile'; null = any).
-- The rating bar (75th percentile, at least 3) is measured inside the
-- generation, so older generations with fewer ratings still fill their list.
create or replace function public.smart_list_compute(r jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_types      text[];
  v_tiers      text[];
  v_genres     text[];
  v_from       integer;
  v_to         integer;
  v_platform   bigint;
  v_generation text;
  v_limit      integer;
  v_result     jsonb;
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
  v_generation := case when jsonb_typeof(r->'generation') = 'string' then r->>'generation' end;
  v_limit := least(500, greatest(1, coalesce(case when jsonb_typeof(r->'limit') = 'number' then (r->>'limit')::integer end, 500)));

  if coalesce(r->>'rankBy', 'average') = 'likes' then
    with liked as (
      select l.game_id, count(*)::integer as likes from public.game_likes l group by l.game_id
    ),
    rated as (
      select q.game_id, avg(q.rating)::numeric as avg_rating, count(*)::integer as n from public.game_ratings q group by q.game_id
    ),
    typed as (
      select k.game_id, k.likes, rt.avg_rating, coalesce(rt.n, 0) as n,
             coalesce(g.entry_type, 'game') as etype, g.release_year, coalesce(g.genres, '{}') as genres,
             case when v_generation is not null -- only lists with a generation rule pay for it
               then public.platform_group_of(g.launch_platform_ids, g.release_platform_ids) end as grp
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
         and (v_generation is null or t.grp = v_generation)
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
    select x.*
      from (
        select p.game_id, p.avg_rating, p.n,
               coalesce(g.entry_type, 'game') as etype,
               g.release_year,
               coalesce(g.genres, '{}') as genres,
               case when v_generation is not null
                    then public.platform_group_of(g.launch_platform_ids, g.release_platform_ids) end as grp
          from per_game p
          left join public.games g on g.igdb_id = p.game_id
      ) x
     where v_generation is null or x.grp = v_generation
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

-- Seeded lists carry a fixed key ('generation:6', 'generation:pc', …) so the
-- badge can find them. Only the database sets it.
alter table public.lists add column if not exists system_key text;
create unique index if not exists uq_lists_system_key on public.lists (system_key) where system_key is not null;

create or replace function public.lists_guard_system_key()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if ((tg_op = 'INSERT' and new.system_key is not null)
      or (tg_op = 'UPDATE' and new.system_key is distinct from old.system_key))
     and current_user in ('authenticated', 'anon') then
    raise exception 'System lists are made by the app.' using errcode = 'LS006';
  end if;
  return new;
end;
$$;

drop trigger if exists lists_guard_system_key on public.lists;
create trigger lists_guard_system_key
  before insert or update on public.lists
  for each row execute function public.lists_guard_system_key();

-- One public smart list per group, owned by the app owner. Titles match
-- generationListTitle() in src/constants/generations.ts (SQL test). Safe to
-- run again: existing lists are left alone. Returns how many it made.
create or replace function private.seed_generation_lists()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_count integer := 0;
  v_rows  integer;
  s       record;
begin
  select a.user_id into v_owner
    from public.app_admins a
    join public.profiles p on p.id = a.user_id
   where a.is_owner;
  if v_owner is null then
    return 0; -- no owner yet (a fresh database): the app_admins trigger below seeds them later
  end if;

  -- lists_before_write lets only a signed-in admin set a smart rule; this is the database itself.
  alter table public.lists disable trigger lists_before_write;
  for s in
    select * from (values
      ('1', 'Top 250: 1st Generation (1972–1983)'),
      ('2', 'Top 250: 2nd Generation (1976–1992)'),
      ('3', 'Top 250: 3rd Generation (1983–2003)'),
      ('4', 'Top 250: 4th Generation (1987–2004)'),
      ('5', 'Top 250: 5th Generation (1993–2006)'),
      ('6', 'Top 250: 6th Generation (1998–2013)'),
      ('7', 'Top 250: 7th Generation (2005–2017)'),
      ('8', 'Top 250: 8th Generation (2012–2020s)'),
      ('9', 'Top 250: 9th Generation (2020–present)'),
      ('pc', 'Top 250: PC & computers'),
      ('arcade', 'Top 250: Arcade'),
      ('mobile', 'Top 250: Mobile')
    ) v(grp, title)
  loop
    insert into public.lists (user_id, title, description, is_ranked, is_public, smart_rule, system_key)
    values (
      v_owner,
      s.title,
      case when s.grp ~ '^[1-9]$'
        then 'The best-rated games first released in this console generation, by Gamer Cred average. Updated every night.'
        else 'The best-rated games first released here, by Gamer Cred average. Updated every night.'
      end,
      true,
      true,
      jsonb_build_object(
        'rankBy', 'average', 'entryTypes', jsonb_build_array('game', 'remake'), 'tiers', '[]'::jsonb,
        'yearFrom', null, 'yearTo', null, 'genres', '[]'::jsonb, 'platformId', null,
        'generation', s.grp, 'limit', 250),
      'generation:' || s.grp
    )
    on conflict (system_key) where system_key is not null do nothing;
    get diagnostics v_rows = row_count;
    v_count := v_count + v_rows;
  end loop;
  alter table public.lists enable trigger lists_before_write;
  return v_count;
end;
$$;

revoke all on function private.seed_generation_lists() from public, anon, authenticated;

create or replace function private.app_owner_seed_lists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.seed_generation_lists();
  return null;
end;
$$;

revoke all on function private.app_owner_seed_lists() from public, anon, authenticated;

drop trigger if exists app_admins_seed_generation_lists on public.app_admins;
create trigger app_admins_seed_generation_lists
  after insert or update of is_owner on public.app_admins
  for each row when (new.is_owner)
  execute function private.app_owner_seed_lists();

select private.seed_generation_lists();

-- ---- 5. the game page badge ---------------------------------------------------------------------
-- Null when the game has no listed platform (or isn't in public.games yet).
-- rank comes from last night's saved list (null = not in the Top 250).
create or replace function public.game_generation_badge(p_game_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  g          public.games;
  v_group    text;
  v_remake   text;
  v_remaster text[];
  v_list     uuid;
  v_rank     integer;
begin
  select * into g from public.games where igdb_id = p_game_id;
  if not found then
    return null;
  end if;
  v_group := public.platform_group_of(g.launch_platform_ids, g.release_platform_ids);
  if v_group is null then
    return null;
  end if;

  -- A remake: the group of the game it remakes.
  if g.entry_type = 'remake' then
    v_remake := coalesce(
      public.platform_group_of(g.remake_of_platform_ids, g.remake_of_platform_ids),
      (select public.platform_group_of(o.launch_platform_ids, o.release_platform_ids) from public.games o where o.igdb_id = g.remake_of)
    );
  end if;

  -- Remasters on later console generations (any console, for a PC / arcade / mobile original).
  v_remaster := array(
    select x.generation
      from (select distinct pg.generation
              from unnest(g.remaster_platform_ids) rp(id)
              join public.platform_generations pg on pg.platform_id = rp.id
             where pg.generation ~ '^[1-9]$'
               and (v_group !~ '^[1-9]$' or pg.generation::integer > v_group::integer)) x
     order by x.generation::integer
  );

  select l.id into v_list
    from public.lists l
   where l.system_key = 'generation:' || v_group
     and l.is_public;
  if v_list is not null then
    select (e ->> 'rank')::integer into v_rank
      from public.smart_list_cache c
      cross join lateral jsonb_array_elements(coalesce(c.result -> 'games', '[]'::jsonb)) e
     where c.list_id = v_list
       and (e ->> 'gameId')::bigint = p_game_id
     limit 1;
  end if;

  return jsonb_build_object(
    'generation', v_group,
    'releaseYear', g.release_year,
    'remakeOf', v_remake,
    'remasteredFor', to_jsonb(v_remaster),
    'listId', v_list,
    'rank', v_rank
  );
end;
$$;

revoke execute on function public.game_generation_badge(bigint) from public, anon;
grant execute on function public.game_generation_badge(bigint) to authenticated;

-- ---- 6. stats: your games by generation --------------------------------------------------------
-- 'unknown' = no listed platform, or no catalogue data yet.
create or replace function public.stats_generations()
returns table (generation text, games integer, rated_games integer, average_rating numeric)
language sql stable security invoker set search_path = ''
as $$
  with logged as (
    select l.game_id, l.rating,
           coalesce(public.platform_group_of(g.launch_platform_ids, g.release_platform_ids), 'unknown') as grp
      from public.my_logged_games() l
      left join public.games g on g.igdb_id = l.game_id
  )
  select l.grp, count(*)::integer, count(l.rating)::integer, round(avg(l.rating), 1)
    from logged l
   group by l.grp
   order by public.platform_group_sort(l.grp);
$$;

revoke execute on function public.stats_generations() from public, anon;
grant execute on function public.stats_generations() to authenticated;
