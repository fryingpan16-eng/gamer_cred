-- =============================================================================
-- gamer_cred — 000042 other versions fold into their original
--
-- IGDB lists some re-releases as their own "expanded game": Death Stranding
-- Director's Cut, Ghost of Tsushima Director's Cut. From now on they are not
-- their own catalogue entries: like remasters, they share the original's page,
-- ratings and reviews (igdb-proxy curation.ts, versionOriginalOf; a few such as
-- Persona 5 Royal keep their own entry).
--
-- Saved data on a version's old id moves to the original. The Edge Function
-- finds the pairs (it is the only part that can ask IGDB) and calls
-- merge_game_version once per pair, the first time it sees a folded id.
--
-- 1. game_merges: version id → original id. Public read (it is IGDB data, no
--    user data); only merge_game_version writes.
-- 2. Saves made later on an old id (a stale screen, an old app build) land on
--    the original: a first-running before-insert/update trigger on every table
--    that stores a game id.
-- 3. The review / rating sync triggers stand aside while a merge runs (a
--    transaction-local setting), so the merge decides every row itself.
-- 4. merge_game_version(from, to): moves reviews, ratings, Now Playing,
--    favorites, likes, backlog, list items and replays. Where a player has both:
--      reviews       all kept; later ones become replays. Two drafts → the
--                    newer stays (one draft per game).
--      rating        the current review's score if there is one, else the
--                    newer rating.
--      Now Playing   the newer slot; Top 4 the better rank; likes, backlog,
--                    list items once.
--    Service role only.
--
-- Non-destructive for single copies; duplicate copies are resolved as above.
-- =============================================================================

-- ---- 1. game_merges -------------------------------------------------------------------------
create table if not exists public.game_merges (
  from_id    bigint primary key,
  to_id      bigint not null,
  created_at timestamptz not null default now(),
  constraint game_merges_not_self check (from_id <> to_id)
);

create index if not exists idx_game_merges_to on public.game_merges (to_id);

alter table public.game_merges enable row level security;

create policy "game_merges: public read" on public.game_merges for select using (true);
-- No write policies: only merge_game_version (security definer) writes.

revoke all on public.game_merges from anon, authenticated;
grant select on public.game_merges to anon, authenticated;

comment on table public.game_merges is
  'Other versions folded into their original (000042). Written by merge_game_version only.';

-- ---- 2. saves on an old id land on the original ---------------------------------------------
create or replace function private.redirect_merged_game()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to bigint;
begin
  select m.to_id into v_to from public.game_merges m where m.from_id = new.game_id;
  if v_to is not null then
    new.game_id := v_to;
  end if;
  return new;
end;
$$;

revoke all on function private.redirect_merged_game() from public;

-- Named "a_…" so it runs before the tables' other before-triggers (alphabetical order).
do $$
declare
  t text;
begin
  foreach t in array array['reviews', 'game_ratings', 'now_playing', 'user_favorites', 'game_likes',
                           'game_backlog', 'list_items', 'game_replays'] loop
    execute format('drop trigger if exists a_redirect_merged_game on public.%I', t);
    execute format('create trigger a_redirect_merged_game before insert or update of game_id on public.%I
                      for each row execute function private.redirect_merged_game()', t);
  end loop;
end;
$$;

-- ---- 3. sync triggers stand aside during a merge --------------------------------------------
create or replace function private.merging_games()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('gamercred.merging_games', true), '') = 'on';
$$;

-- From 000040, plus the merge check.
create or replace function public.reviews_replay_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_created timestamptz := case when tg_op = 'INSERT' then now() else old.created_at end;
begin
  if private.merging_games() then
    return new; -- merge_game_version moves rows itself (000042)
  end if;
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.game_id := old.game_id;
  end if;
  if exists (
    select 1 from public.reviews o
     where o.user_id = new.user_id and o.game_id = new.game_id and o.id <> new.id
       and (tg_op = 'INSERT' or o.created_at < v_created)
  ) then
    new.is_replay := true;
  end if;
  if new.is_replay and new.finished_on is null then
    new.finished_on := current_date;
  end if;
  if new.finished_on is not null and new.finished_on > current_date + 1 then
    raise exception 'The finish date can''t be in the future.' using errcode = 'RP001';
  end if;
  return new;
end;
$$;

-- From 000040, plus the merge check.
create or replace function public.reviews_sync_game_rating()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c public.reviews%rowtype;
begin
  if private.merging_games() then
    return null; -- merge_game_version moves rows itself (000042)
  end if;
  select r.* into c from public.reviews r
   where r.user_id = new.user_id and r.game_id = new.game_id
     and not (r.is_replay and r.status = 'draft')
   order by r.created_at desc, r.id desc
   limit 1;
  if c.id is null or c.rating is null then
    return null; -- nothing scored to sync (an unscored draft leaves the quick rating alone)
  end if;
  if c.id <> new.id and not (tg_op = 'UPDATE' and new.is_replay and old.status = 'published' and new.status = 'draft') then
    return null; -- an older review, or a replay draft not yet published
  end if;
  insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, platform_id)
  values (c.user_id, c.game_id, c.rating, c.rating_input_scale, c.rating_input, c.platform_id)
  on conflict (user_id, game_id) do update
    set rating = excluded.rating,
        rating_input_scale = excluded.rating_input_scale,
        rating_input = excluded.rating_input,
        platform_id = coalesce(excluded.platform_id, public.game_ratings.platform_id)
    where (public.game_ratings.rating, public.game_ratings.rating_input_scale, public.game_ratings.rating_input,
           public.game_ratings.platform_id)
          is distinct from (excluded.rating, excluded.rating_input_scale, excluded.rating_input,
                            coalesce(excluded.platform_id, public.game_ratings.platform_id));
  return null;
end;
$$;

-- From 000040, plus the merge check.
create or replace function public.game_ratings_sync_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.merging_games() then
    return null; -- merge_game_version moves rows itself (000042)
  end if;
  update public.reviews r
     set rating = new.rating,
         rating_input_scale = new.rating_input_scale,
         rating_input = new.rating_input,
         platform_id = coalesce(new.platform_id, r.platform_id)
   where r.id = (
           select c.id from public.reviews c
            where c.user_id = new.user_id and c.game_id = new.game_id
              and not (c.is_replay and c.status = 'draft')
            order by c.created_at desc, c.id desc
            limit 1
         )
     and (r.rating, r.rating_input_scale, r.rating_input, r.platform_id)
         is distinct from (new.rating, new.rating_input_scale, new.rating_input, coalesce(new.platform_id, r.platform_id));
  return null;
end;
$$;

-- From 000040, plus the merge check.
create or replace function public.reviews_after_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v public.reviews%rowtype;
begin
  if private.merging_games() then
    return null; -- merge_game_version moves rows itself (000042)
  end if;
  if pg_trigger_depth() > 1 or (old.is_replay and old.status = 'draft') then
    return null; -- cascades, and replay drafts (never the current review)
  end if;
  select c.* into v from public.reviews c
   where c.user_id = old.user_id and c.game_id = old.game_id
     and not (c.is_replay and c.status = 'draft')
   order by c.created_at desc, c.id desc
   limit 1;
  if v.id is null or v.rating is null or v.created_at > old.created_at then
    return null; -- nothing left to fall back to, or the deleted review wasn't the current one
  end if;
  update public.game_ratings q
     set rating = v.rating, rating_input_scale = v.rating_input_scale, rating_input = v.rating_input,
         platform_id = coalesce(v.platform_id, q.platform_id)
   where q.user_id = old.user_id and q.game_id = old.game_id
     and (q.rating, q.rating_input_scale, q.rating_input) is distinct from (v.rating, v.rating_input_scale, v.rating_input);
  return null;
end;
$$;

-- From 000015, plus the merge check.
create or replace function public.game_ratings_before_clear()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.merging_games() then
    return old; -- merge_game_version moves rows itself (000042)
  end if;
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

-- ---- 4. merge_game_version ------------------------------------------------------------------
-- Returns how many rows moved (0 when the id had no saved data). Safe to call
-- again: a repeated pair moves nothing.
create or replace function public.merge_game_version(p_from bigint, p_to bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to    bigint;
  v_users uuid[];
  v_n     integer;
  v_moved integer := 0;
begin
  if p_from is null or p_to is null or p_from <= 0 or p_to <= 0 or p_from = p_to then
    raise exception 'Invalid game merge.' using errcode = 'GM001';
  end if;

  -- One merge at a time (they are rare), so two calls can't interleave.
  perform pg_advisory_xact_lock(42000042);

  -- The original may itself have been folded into another game.
  select coalesce((select m.to_id from public.game_merges m where m.from_id = p_to), p_to) into v_to;
  if v_to = p_from then
    raise exception 'Invalid game merge (loop).' using errcode = 'GM001';
  end if;

  insert into public.game_merges (from_id, to_id) values (p_from, v_to)
  on conflict (from_id) do update set to_id = excluded.to_id;
  update public.game_merges set to_id = v_to where to_id = p_from;

  perform set_config('gamercred.merging_games', 'on', true);

  -- Players with reviews or ratings on the old id (their score is re-synced below).
  select coalesce(array_agg(distinct u), '{}') into v_users
    from (select r.user_id as u from public.reviews r where r.game_id = p_from
          union select q.user_id from public.game_ratings q where q.game_id = p_from) s;

  -- Reviews: one draft per game — the newer draft stays.
  delete from public.reviews d
   using public.reviews k
   where d.status = 'draft' and k.status = 'draft' and d.user_id = k.user_id
     and d.game_id in (p_from, v_to) and k.game_id in (p_from, v_to) and d.game_id <> k.game_id
     and (d.updated_at, d.id) < (k.updated_at, k.id);
  update public.reviews set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  -- Every review after a player's first one of the game is a replay.
  update public.reviews r
     set is_replay = true,
         finished_on = coalesce(r.finished_on, least(coalesce(r.published_at, r.created_at)::date, current_date))
    from (select x.id, row_number() over (partition by x.user_id order by x.created_at, x.id) as n
            from public.reviews x
           where x.game_id = v_to and x.user_id = any (v_users)) o
   where r.id = o.id and o.n > 1 and not r.is_replay;

  -- Ratings: the newer one stays (a tie keeps the original's)…
  delete from public.game_ratings d
   using public.game_ratings k
   where d.user_id = k.user_id
     and d.game_id in (p_from, v_to) and k.game_id in (p_from, v_to) and d.game_id <> k.game_id
     and (d.updated_at, d.game_id = v_to) < (k.updated_at, k.game_id = v_to);
  update public.game_ratings set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  -- …unless the player has a scored current review: that score is the rating.
  insert into public.game_ratings (user_id, game_id, rating, rating_input_scale, rating_input, platform_id)
  select c.user_id, c.game_id, c.rating, c.rating_input_scale, c.rating_input, c.platform_id
    from (select distinct on (r.user_id) r.*
            from public.reviews r
           where r.game_id = v_to and r.user_id = any (v_users) and not (r.is_replay and r.status = 'draft')
           order by r.user_id, r.created_at desc, r.id desc) c
   where c.rating is not null
  on conflict (user_id, game_id) do update
    set rating = excluded.rating,
        rating_input_scale = excluded.rating_input_scale,
        rating_input = excluded.rating_input,
        platform_id = coalesce(excluded.platform_id, public.game_ratings.platform_id)
    where (public.game_ratings.rating, public.game_ratings.rating_input_scale, public.game_ratings.rating_input)
          is distinct from (excluded.rating, excluded.rating_input_scale, excluded.rating_input);

  -- Now Playing: the newer slot stays.
  delete from public.now_playing d
   using public.now_playing k
   where d.user_id = k.user_id
     and d.game_id in (p_from, v_to) and k.game_id in (p_from, v_to) and d.game_id <> k.game_id
     and (d.updated_at, d.game_id = v_to) < (k.updated_at, k.game_id = v_to);
  update public.now_playing set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  -- Top 4: the better rank stays.
  delete from public.user_favorites d
   using public.user_favorites k
   where d.user_id = k.user_id
     and d.game_id in (p_from, v_to) and k.game_id in (p_from, v_to) and d.game_id <> k.game_id
     and d.rank > k.rank;
  update public.user_favorites set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  -- Likes, backlog, list items: once each.
  delete from public.game_likes d
   where d.game_id = p_from
     and exists (select 1 from public.game_likes k where k.user_id = d.user_id and k.game_id = v_to);
  update public.game_likes set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  delete from public.game_backlog d
   where d.game_id = p_from
     and exists (select 1 from public.game_backlog k where k.user_id = d.user_id and k.game_id = v_to);
  update public.game_backlog set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;
  -- A rated game leaves the backlog (000035).
  delete from public.game_backlog b
   where b.game_id = v_to and b.user_id = any (v_users)
     and exists (select 1 from public.game_ratings q where q.user_id = b.user_id and q.game_id = v_to);

  delete from public.list_items d
   where d.game_id = p_from
     and exists (select 1 from public.list_items k where k.list_id = d.list_id and k.game_id = v_to);
  update public.list_items set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  update public.game_replays set game_id = v_to where game_id = p_from;
  get diagnostics v_n = row_count;
  v_moved := v_moved + v_n;

  -- The old id's catalogue row (Stats, smart lists) is gone; the original's stays.
  delete from public.games where igdb_id = p_from;

  perform set_config('gamercred.merging_games', 'off', true);
  return v_moved;
end;
$$;

revoke all on function public.merge_game_version(bigint, bigint) from public, anon, authenticated;
