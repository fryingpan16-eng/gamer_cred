-- =============================================================================
-- gamer_cred — 000050 app owner (2026-11-16)
--
-- 1. app_admins.is_owner: exactly one admin is the app owner.
-- 2. admin_removal_block: for the `account` Edge Function. Nobody removes the
--    owner's account, and only the owner removes another admin's.
-- 3. admin_demote: the owner takes the admin role away from an admin without
--    deleting their account (logged). admin_can_demote drives the menu entry.
--
-- Adding an admin and moving the owner flag stay SQL-editor only.
-- =============================================================================

-- ---- 1. the owner -----------------------------------------------------------------------------
alter table public.app_admins add column if not exists is_owner boolean not null default false;

-- The first admin (000019) is the project owner.
update public.app_admins set is_owner = true
 where user_id = 'fc630ef2-b4c5-4960-ac31-529a3550fe57';

-- Elsewhere (another environment): a sole admin is the owner.
update public.app_admins set is_owner = true
 where not exists (select 1 from public.app_admins o where o.is_owner)
   and (select count(*) from public.app_admins) = 1;

do $$
begin
  if exists (select 1 from public.app_admins) and not exists (select 1 from public.app_admins where is_owner) then
    raise exception 'Several admins and no owner: set app_admins.is_owner = true on the owner''s row, then run this migration again.';
  end if;
end;
$$;

create unique index if not exists uq_app_admins_one_owner on public.app_admins ((true)) where is_owner;

-- ---- 2. who may remove whose account ----------------------------------------------------------
-- Service role only (the `account` Edge Function, which has already checked the
-- caller is a verified admin). null = allowed; 'owner' = the target is the app
-- owner (never removed); 'admin' = the target is an admin and the caller isn't the owner.
create or replace function public.admin_removal_block(p_caller uuid, p_target uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when t.is_owner then 'owner'
           when not exists (select 1 from public.app_admins c where c.user_id = p_caller and c.is_owner) then 'admin'
         end
    from public.app_admins t
   where t.user_id = p_target;
$$;

revoke all on function public.admin_removal_block(uuid, uuid) from public, anon, authenticated;

-- ---- 3. demote an admin -----------------------------------------------------------------------
-- The caller is the owner with a verified session, and p_user is another admin.
create or replace function public.admin_can_demote(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.is_app_admin())
     and exists (select 1 from public.app_admins c where c.user_id = (select auth.uid()) and c.is_owner)
     and exists (select 1 from public.app_admins t where t.user_id = p_user and not t.is_owner);
$$;

revoke execute on function public.admin_can_demote(uuid) from public, anon;
grant execute on function public.admin_can_demote(uuid) to authenticated;

-- Takes the admin role (and the approved authenticator pin) away; the account,
-- and everything the player posted, stays.
create or replace function public.admin_demote(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select public.is_app_admin())
     or not exists (select 1 from public.app_admins c where c.user_id = (select auth.uid()) and c.is_owner) then
    raise exception 'Only the app owner can remove an admin.' using errcode = 'LS001';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'The app owner can''t be demoted.' using errcode = 'AD001';
  end if;
  delete from public.app_admins where user_id = p_user and not is_owner;
  if not found then
    raise exception 'That player isn''t an admin.' using errcode = 'AD002';
  end if;
  perform public.log_admin_action('admin.demote', 'user', p_user::text);
end;
$$;

revoke execute on function public.admin_demote(uuid) from public, anon;
grant execute on function public.admin_demote(uuid) to authenticated;
