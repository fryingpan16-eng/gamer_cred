-- =============================================================================
-- gamer_cred — 000002 auth → profile provisioning
--
-- Every auth.users row (email sign-up or Google OAuth) gets a public.profiles
-- row automatically, so clients never need to insert profiles themselves.
-- =============================================================================

-- Usernames are unique case-insensitively ("Gordon" and "gordon" collide).
create unique index uq_profiles_username_ci on public.profiles (lower(username));

-- -----------------------------------------------------------------------------
-- Username availability check for the register form (callable by anon).
-- SECURITY DEFINER is not needed: profiles are publicly readable.
-- -----------------------------------------------------------------------------
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,24}$'
     and not exists (
       select 1 from public.profiles p where lower(p.username) = lower(candidate)
     );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Profile provisioning trigger
--   username: raw_user_meta_data.username (email sign-up) if valid & free,
--             otherwise derived from full_name / email + random suffix.
--   avatar:   raw_user_meta_data.avatar_url / picture (Google provides these).
-- -----------------------------------------------------------------------------
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
  if requested is not null and public.is_username_available(requested) then
    candidate := requested;
  else
    base := regexp_replace(
      lower(coalesce(meta ->> 'full_name', meta ->> 'name', split_part(new.email, '@', 1), 'player')),
      '[^a-z0-9_]', '', 'g'
    );
    base := left(base, 18);
    if char_length(base) < 3 then
      base := 'player';
    end if;

    loop
      candidate := base || '_' || substr(md5(random()::text), 1, 4);
      exit when public.is_username_available(candidate);
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
