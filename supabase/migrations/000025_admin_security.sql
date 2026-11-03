-- =============================================================================
-- gamer_cred — 000025 admin security: two-step sign-in + activity log
--
-- 1. Every admin power now needs a session verified with an authenticator code
--    (Supabase MFA, TOTP → JWT claim aal = 'aal2'). is_app_admin() is the single
--    check used by every admin RPC, trigger and RLS policy, so changing it
--    covers them all. is_app_admin_member() only says "this account is an
--    admin" (so the app can offer the code prompt); it grants nothing.
-- 2. admin_actions: who did what, when. Written only by security-definer
--    functions (as a verified admin) and the Edge Functions' service role;
--    readable only by verified admins; never editable.
--
-- Lost authenticator: delete the factor in Supabase → Authentication → Users,
-- then enrol a new one in the app.
-- =============================================================================

-- ---- 1. checks ------------------------------------------------------------------
create or replace function public.is_app_admin_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()));
$$;

grant execute on function public.is_app_admin_member() to authenticated;
revoke execute on function public.is_app_admin_member() from public, anon;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
     and coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2';
$$;

-- ---- 2. activity log ------------------------------------------------------------
create table public.admin_actions (
  id          bigint generated always as identity primary key,
  -- Kept (as null) if the admin's account is later deleted.
  admin_id    uuid references public.profiles (id) on delete set null,
  -- e.g. 'list.feature', 'list.unfeature', 'list.smart_rule', 'reports.dismiss',
  -- 'reports.remove', 'avatar.approve', 'avatar.reject', 'user.remove'
  action      text not null check (char_length(action) between 1 and 60),
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index idx_admin_actions_created on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

create policy "admin_actions: verified admins read" on public.admin_actions
  for select to authenticated using (public.is_app_admin());
-- No insert/update/delete policies: entries can't be written or changed from the app.

-- Records an action by the calling verified admin; a no-op for anyone else.
create or replace function public.log_admin_action(p_action text, p_target_type text, p_target_id text, p_details jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    return;
  end if;
  insert into public.admin_actions (admin_id, action, target_type, target_id, details)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, p_details);
end;
$$;

grant execute on function public.log_admin_action(text, text, text, jsonb) to authenticated;
revoke execute on function public.log_admin_action(text, text, text, jsonb) from public, anon;

-- Newest first, with the admin's name (Moderation → Activity).
create or replace function public.admin_activity(p_limit integer default 100)
returns table (
  id bigint,
  created_at timestamptz,
  admin_id uuid,
  admin_name text,
  action text,
  target_type text,
  target_id text,
  details jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can see the activity log.' using errcode = 'LS001';
  end if;
  return query
  select a.id, a.created_at, a.admin_id, p.username, a.action, a.target_type, a.target_id, a.details
    from public.admin_actions a
    left join public.profiles p on p.id = a.admin_id
   order by a.created_at desc, a.id desc
   limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

grant execute on function public.admin_activity(integer) to authenticated;
revoke execute on function public.admin_activity(integer) from public, anon;

-- ---- 3. log the database-side admin actions ---------------------------------------

-- Same as 000019, plus a log entry.
create or replace function public.set_list_pin(p_list_id uuid, p_rank smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can pin lists to the Home tab.' using errcode = 'LS001';
  end if;
  if p_rank is not null then
    update public.lists set pinned_rank = null where pinned_rank = p_rank and id <> p_list_id;
  end if;
  update public.lists set pinned_rank = p_rank where id = p_list_id returning title into v_title;
  if not found then
    raise exception 'List not found.' using errcode = 'LS004';
  end if;
  perform public.log_admin_action(
    case when p_rank is null then 'list.unfeature' else 'list.feature' end,
    'list', p_list_id::text, jsonb_build_object('title', v_title, 'rank', p_rank));
end;
$$;

-- Same as 000023, plus a log entry when a smart rule is set or changed.
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
    perform public.log_admin_action('list.smart_rule', 'list', new.id::text,
      jsonb_build_object('title', new.title, 'rule', new.smart_rule));
  end if;
  if new.smart_rule is not null then
    new.is_ranked := true;
  end if;
  return new;
end;
$$;

-- Same as 000021, plus a log entry.
create or replace function public.admin_resolve_reports(
  p_target_type public.report_target,
  p_target_id text,
  p_target_user uuid,
  p_remove boolean,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_app_admin() then
    raise exception 'Only app admins can resolve reports.' using errcode = 'LS001';
  end if;
  if p_remove then
    case p_target_type
      when 'review' then delete from public.reviews where id::text = p_target_id;
      when 'list' then delete from public.lists where id::text = p_target_id;
      when 'rating' then
        -- A published review needs its score: removing the rating removes that review too.
        delete from public.reviews where user_id = p_target_user and game_id::text = p_target_id;
        delete from public.game_ratings where user_id = p_target_user and game_id::text = p_target_id;
      when 'user' then
        raise exception 'Remove users with the account function (it deletes the sign-in too).' using errcode = 'SF004';
    end case;
  end if;
  update public.content_reports
     set status = case when p_remove then 'actioned'::public.report_status else 'dismissed'::public.report_status end,
         resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_note
   where target_type = p_target_type and target_id = p_target_id and status = 'open';
  get diagnostics v_count = row_count;
  perform public.log_admin_action(
    case when p_remove then 'reports.remove' else 'reports.dismiss' end,
    p_target_type::text, p_target_id,
    jsonb_build_object('targetUser', p_target_user, 'reports', v_count, 'note', p_note));
  return v_count;
end;
$$;
