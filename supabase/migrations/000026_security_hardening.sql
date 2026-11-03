-- =============================================================================
-- gamer_cred — 000026 security hardening (audit, 2026-11-03)
--
-- 1. Friend requests: the two players on a request can't be changed, and the
--    only status change is pending → accepted / rejected. (Before, the
--    recipient could rewrite the sender and "accept" a friendship someone else
--    never asked for, which exposed friends-only content.)
-- 2. Objectionable-text backstop in the database. The app's filter (obscenity)
--    stays the main check; this catches requests that skip the app. New
--    sign-ups whose Google name or chosen username fails get a neutral name.
-- 3. Signed-in users only: every read policy that was open to signed-out
--    requests (the public anon key) now needs a session, like the app does.
-- 4. Signed-out requests can't call the elevated (security definer) functions.
-- 5. Missing foreign-key indexes.
-- 6. igdb-proxy rate limiting (per user, per minute), plus scheduled cleanup
--    of the IGDB cache and the rate-limit counters when pg_cron is available.
-- =============================================================================

-- ---- 1. friend requests ------------------------------------------------------------
create or replace function public.friendships_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id or new.friend_id is distinct from old.friend_id then
    raise exception 'The players on a friend request can''t be changed.' using errcode = 'SF005';
  end if;
  if new.status is distinct from old.status
     and not (old.status::text = 'pending' and new.status::text in ('accepted', 'rejected', 'declined')) then
    raise exception 'That friend request can''t be changed.' using errcode = 'SF006';
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_guard_update on public.friendships;
create trigger friendships_guard_update
  before update on public.friendships
  for each row execute function public.friendships_guard_update();

-- ---- 2. objectionable text ---------------------------------------------------------
-- A deliberately small, high-confidence list (slurs and strong profanity). It must
-- never block something the app's filter allows, so ambiguous words only match as
-- whole words, and known innocent words are allowed first.
-- Text is lower-cased, common l33t swaps undone, and split into words on anything
-- that isn't a letter (so "fuck_you99" and "xXslurXx" are caught); "f+u+c+k+"
-- style patterns also catch stretched letters.
create or replace function public.contains_objectionable(p_text text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  t text;
begin
  if p_text is null or btrim(p_text) = '' then
    return false;
  end if;
  t := translate(lower(p_text), '4@31!0$5+7', 'aaeiiossst');
  t := regexp_replace(t, 'shiitake|shitake|cockpit|cocktail|peacock|hancock|woodcock|pussycat|pussy willow|scunthorpe|assassin|cockatoo|cockatiel', ' ', 'g');
  t := ' ' || regexp_replace(t, '[^a-z]+', ' ', 'g') || ' ';
  -- Anywhere inside a word.
  if t ~ '(f+[ua]+c+k+|c+u+n+t+|n+i+g+g+e+r+|n+i+g+g+a+|f+a+g+g+o+t+|b+i+t+c+h+|w+h+o+r+e+|a+s+s+h+o+l+e+|d+i+l+d+o+|b+l+o+w+j+o+b+|h+a+n+d+j+o+b+|j+i+z+z+|s+h+i+t+)' then
    return true;
  end if;
  -- Whole words only (these appear inside innocent words).
  return t ~ ' (a+s+s+|c+o+c+k+s?|f+a+g+s?|k+i+k+e+s?|c+h+i+n+k+s?|r+e+t+a+r+d+(s|e+d+)?|t+r+a+n+n+y+|t+w+a+t+s?|w+a+n+k+(e+r+s?)?|c+u+m+|p+o+r+n+|r+a+p+e+|r+a+p+i+s+t+s?|s+l+u+t+s?|p+i+s+s+|p+r+i+c+k+s?|p+e+n+i+s+|v+a+g+i+n+a+|p+u+s+s+y+|d+y+k+e+s?|n+e+g+r+o+) ';
end;
$$;

-- Trigger: rejects a write when one of the named columns CHANGES to objectionable
-- text (existing rows are never blocked from unrelated edits).
create or replace function public.reject_objectionable()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col text;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
begin
  foreach col in array tg_argv loop
    if (v_new ->> col) is distinct from (v_old ->> col) and public.contains_objectionable(v_new ->> col) then
      raise exception 'Please keep it clean — that contains language GamerCred doesn''t allow.' using errcode = 'CF001';
    end if;
  end loop;
  return new;
end;
$$;

create trigger profiles_reject_objectionable before insert or update of username on public.profiles
  for each row execute function public.reject_objectionable('username');
create trigger lists_reject_objectionable before insert or update of title, description on public.lists
  for each row execute function public.reject_objectionable('title', 'description');
create trigger reviews_reject_objectionable before insert or update of content on public.reviews
  for each row execute function public.reject_objectionable('content');
create trigger now_playing_reject_objectionable before insert or update of notes on public.now_playing
  for each row execute function public.reject_objectionable('notes');
create trigger user_platforms_reject_objectionable before insert or update of devices on public.user_platforms
  for each row execute function public.reject_objectionable('devices');

-- Sign-up: same as 000002, but a chosen or Google-derived name that fails the
-- filter is replaced with a neutral one instead of failing the sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested  text  := meta ->> 'username';
  base       text;
  candidate  text;
  attempt    int   := 0;
begin
  if requested is not null
     and not public.contains_objectionable(replace(requested, '_', ' '))
     and public.is_username_available(requested) then
    candidate := requested;
  else
    base := regexp_replace(
      lower(coalesce(meta ->> 'full_name', meta ->> 'name', split_part(new.email, '@', 1), 'player')),
      '[^a-z0-9_]', '', 'g'
    );
    base := left(base, 18);
    if char_length(base) < 3 or public.contains_objectionable(replace(base, '_', ' ')) then
      base := 'player';
    end if;

    loop
      candidate := base || '_' || substr(md5(random()::text), 1, 4);
      exit when public.is_username_available(candidate) and not public.contains_objectionable(replace(candidate, '_', ' '));
      attempt := attempt + 1;
      if attempt > 20 then
        raise exception 'could not allocate a unique username for %', new.id;
      end if;
    end loop;
  end if;

  insert into public.profiles (id, username, avatar_url)
  values (new.id, candidate, coalesce(meta ->> 'avatar_url', meta ->> 'picture'));

  return new;
end;
$$;

-- ---- 3. reads need a session ----------------------------------------------------------
-- Every SELECT policy in public that applies to everyone (role "public") moves to
-- signed-in users. Done by lookup so it covers exactly what exists.
do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public' and cmd = 'SELECT' and roles = '{public}'
  loop
    execute format('alter policy %I on public.%I to authenticated', pol.policyname, pol.tablename);
  end loop;
end;
$$;

-- ---- 4. elevated functions: signed-in callers only ------------------------------------
-- (is_username_available stays open: Register checks names before there's a session.)
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.admin_reports(public.report_status, integer)',
    'public.admin_resolve_reports(public.report_target, text, uuid, boolean, text)',
    'public.block_state(uuid)',
    'public.block_user(uuid)',
    'public.game_review_stats(bigint)',
    'public.is_app_admin()',
    'public.is_hidden_user(uuid)',
    'public.my_blocked_users()',
    'public.set_list_pin(uuid, smallint)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated', f);
    end if;
  end loop;
end;
$$;

-- ---- 5. foreign-key indexes -------------------------------------------------------------
create index if not exists idx_content_reports_resolved_by on public.content_reports (resolved_by);
create index if not exists idx_admin_actions_admin on public.admin_actions (admin_id);

-- ---- 6. igdb-proxy rate limit + cleanup ----------------------------------------------------
create table public.api_rate_limits (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  bucket       text not null,
  window_start timestamptz not null,
  hits         integer not null default 0,
  primary key (user_id, bucket, window_start)
);

create index idx_api_rate_limits_window on public.api_rate_limits (window_start);

-- No policies: only the service role (Edge Functions) touches it.
alter table public.api_rate_limits enable row level security;

-- Counts one call; true while the caller is within p_limit calls per window.
create or replace function public.take_rate_limit(p_user uuid, p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.api_rate_limits as r (user_id, bucket, window_start, hits)
  values (p_user, p_bucket, v_window, 1)
  on conflict (user_id, bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.take_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;

create or replace function public.purge_rate_limits()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.api_rate_limits where window_start < now() - interval '1 hour' returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.purge_rate_limits() from public, anon, authenticated;

-- Nightly cache purge and half-hourly counter cleanup, where pg_cron exists (it does on
-- Supabase; the local test database skips this).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('gamercred-purge-igdb-cache', '17 4 * * *', $c$select public.purge_igdb_cache('30 days')$c$);
    perform cron.schedule('gamercred-purge-rate-limits', '*/30 * * * *', $c$select public.purge_rate_limits()$c$);
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
