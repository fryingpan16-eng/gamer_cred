-- =============================================================================
-- gamer_cred — 000027 guest access (read-only browsing)
--
-- Guests use Supabase anonymous sign-in: a real, signed-in session whose JWT
-- carries is_anonymous = true, so the "reads need a session" rules (000026)
-- still apply. Guests can READ everything a member can, but never write:
--   - a restrictive "members only" policy on every insert / update / delete;
--   - no profile row (so they never appear in player search);
--   - the security-definer write RPCs refuse them too.
-- Bots: anonymous sign-in is behind Cloudflare Turnstile (Supabase Auth CAPTCHA)
-- and Supabase's per-IP limit; igdb-proxy gives guests a lower rate limit.
-- Old guests (30+ days) are deleted nightly.
-- =============================================================================

-- True for an anonymous (guest) session.
create or replace function public.is_guest()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;

grant execute on function public.is_guest() to authenticated;
revoke execute on function public.is_guest() from public, anon;

-- ---- members-only writes --------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'friendships', 'game_ratings', 'lists', 'list_items', 'now_playing', 'profiles', 'reviews',
    'terms_acceptances', 'user_blocks', 'user_favorites', 'user_platforms', 'content_reports'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (not public.is_guest())', t || ': members insert', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (not public.is_guest()) with check (not public.is_guest())', t || ': members update', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (not public.is_guest())', t || ': members delete', t);
  end loop;
end;
$$;

-- Profile pictures (both buckets).
create policy "storage: members insert" on storage.objects as restrictive for insert to authenticated
  with check (not public.is_guest());
create policy "storage: members update" on storage.objects as restrictive for update to authenticated
  using (not public.is_guest()) with check (not public.is_guest());
create policy "storage: members delete" on storage.objects as restrictive for delete to authenticated
  using (not public.is_guest());

-- The security-definer helpers (favourites, Main platform, blocking) only write the
-- caller's own rows keyed to their profile; a guest has no profile, so those fail
-- on the profile foreign key without any extra check.

-- ---- no profile for guests --------------------------------------------------------
-- Same as 000026, plus: anonymous (guest) sign-ins get no profile.
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
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;

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

-- ---- rate limits work for guests too ----------------------------------------------------
-- Guests have no profile, so the counter keys on the sign-in account instead.
alter table public.api_rate_limits drop constraint if exists api_rate_limits_user_id_fkey;
alter table public.api_rate_limits
  add constraint api_rate_limits_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;

-- ---- cleanup -------------------------------------------------------------------------------
create or replace function public.purge_old_guests()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from auth.users where is_anonymous and created_at < now() - interval '30 days' returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.purge_old_guests() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('gamercred-purge-old-guests', '43 4 * * *', $c$select public.purge_old_guests()$c$);
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
