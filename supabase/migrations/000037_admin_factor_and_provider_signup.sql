-- =============================================================================
-- gamer_cred — 000037 admin authenticator pinning + private provider sign-ups
--
-- 1. SECURITY: two-step sign-in used to trust whoever enrolled an authenticator
--    first, so a stolen password unlocked admin for any admin who hadn't set
--    one up yet. Now the project owner pins each admin's approved authenticator
--    (app_admins.mfa_factor_id); admin powers need an aal2 session AND that
--    pinned factor being the account's only verified one. Until it's pinned,
--    admin tools stay locked.
--
--    Pin an admin's authenticator (SQL editor, after they set it up in the app
--    and you've confirmed with them that it's theirs):
--      update public.app_admins a
--         set mfa_factor_id = f.id
--        from auth.mfa_factors f
--       where f.user_id = a.user_id and f.status = 'verified'
--         and a.user_id = '<admin profile id>';
--    Lost phone: delete the factor in Supabase → Authentication → Users, set
--    mfa_factor_id = null, and pin the new one once it's set up.
--
-- 2. PRIVACY: Google (and other provider) sign-ups no longer publish the real
--    name as the username or the provider photo as an unscreened picture. They
--    start as player_xxxx with no picture; both can be changed in the app.
--    Existing accounts are unchanged.
-- =============================================================================

-- ---- 1. pinned admin authenticators ----------------------------------------------------------
alter table public.app_admins add column if not exists mfa_factor_id uuid;

-- The admin's pinned authenticator is set, verified, and their only verified one.
create or replace function private.admin_factor_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select a.mfa_factor_id is not null
       and exists (
         select 1 from auth.mfa_factors f
          where f.id = a.mfa_factor_id and f.user_id = p_user and f.status = 'verified'
       )
       and not exists (
         select 1 from auth.mfa_factors f
          where f.user_id = p_user and f.status = 'verified' and f.id <> a.mfa_factor_id
       )
      from public.app_admins a
     where a.user_id = p_user
  ), false);
$$;

revoke all on function private.admin_factor_ok(uuid) from public, anon;
grant execute on function private.admin_factor_ok(uuid) to authenticated;

-- Same as 000025, plus the pinned authenticator.
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
     and private.admin_factor_ok((select auth.uid()));
$$;

-- For the app's Admin Security panel: has the owner approved your authenticator?
create or replace function public.admin_factor_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.admin_factor_ok((select auth.uid()));
$$;

revoke execute on function public.admin_factor_approved() from public, anon;
grant execute on function public.admin_factor_approved() to authenticated;

-- For the Edge Functions (service role only): is this user an admin with an approved
-- authenticator? They check the session's aal2 themselves.
create or replace function public.admin_ready(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = p_user)
     and private.admin_factor_ok(p_user);
$$;

revoke all on function public.admin_ready(uuid) from public, anon, authenticated;

-- ---- 2. provider sign-ups start private --------------------------------------------------------
-- Same as 000033, except a missing / taken username never falls back to the
-- provider's real name or the email address, and no provider picture is copied.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested  text  := meta ->> 'username';
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
    loop
      candidate := 'player_' || substr(md5(random()::text), 1, 6);
      exit when public.is_username_available(candidate);
      attempt := attempt + 1;
      if attempt > 20 then
        raise exception 'could not allocate a unique username for %', new.id;
      end if;
    end loop;
  end if;

  -- Pictures only ever come through the screening function (000022).
  insert into public.profiles (id, username) values (new.id, candidate);

  return new;
end;
$$;
