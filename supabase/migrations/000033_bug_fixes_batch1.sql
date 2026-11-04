-- =============================================================================
-- gamer_cred — 000033 bug fixes, batch 1 (full code review, 2026-11-03)
--
-- 1. Sign-up could set an unscreened profile picture: handle_new_user copied
--    avatar_url / picture from client-written email sign-up metadata. Only a
--    sign-in provider (Google) may supply one now.
-- 2. Register's "username taken" check always said "available" before sign-in
--    (it read profiles as a signed-out caller after 000026). It now runs with
--    the owner's rights and only answers yes/no.
-- 3. Learning who blocked you: block_state no longer answers "blocked_me", and
--    is_hidden_user (unused since 000031/000032) is removed.
-- 4. Reports: the database fills in WHO a report is about from the reported
--    content (it trusted the client). Rating reports are scoped to one
--    player's rating, for duplicates, counting and resolving.
-- =============================================================================

-- ---- 1. no client-supplied pictures at sign-up -------------------------------------------
-- Same as 000027, except the picture line.
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

  -- Only a sign-in provider (e.g. Google) may supply a starting picture. Email
  -- sign-up metadata is written by the client, so it must never set one: pictures
  -- go through the screening function (000022).
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    candidate,
    case when coalesce(new.raw_app_meta_data ->> 'provider', 'email') <> 'email'
         then coalesce(meta ->> 'avatar_url', meta ->> 'picture')
    end
  );

  return new;
end;
$$;

-- ---- 2. username check works before sign-in ------------------------------------------------
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select candidate ~ '^[A-Za-z0-9_]{3,24}$'
     and not exists (
       select 1 from public.profiles p where lower(p.username) = lower(candidate)
     );
$$;

grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---- 3. nobody learns who blocked them -------------------------------------------------------
create or replace function public.block_state(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.user_blocks where blocker_id = (select auth.uid()) and blocked_id = p_user) then 'blocked_by_me'
    else 'none'
  end;
$$;

drop function if exists public.is_hidden_user(uuid);

-- ---- 4. reports name the real owner ---------------------------------------------------------
create or replace function public.content_reports_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  case new.target_type
    when 'review' then
      select r.user_id into v_owner from public.reviews r where r.id::text = new.target_id and r.status = 'published';
    when 'list' then
      select l.user_id into v_owner from public.lists l where l.id::text = new.target_id;
    when 'user' then
      select p.id into v_owner from public.profiles p where p.id::text = new.target_id;
    when 'rating' then
      -- target_id is the game; the rating must really be this player's.
      select q.user_id into v_owner from public.game_ratings q
       where q.game_id::text = new.target_id and q.user_id = new.target_user_id;
  end case;
  if v_owner is null then
    raise exception 'That content no longer exists.' using errcode = 'SF007';
  end if;
  new.target_user_id := v_owner;
  return new;
end;
$$;

create trigger content_reports_set_owner
  before insert on public.content_reports
  for each row execute function public.content_reports_set_owner();

-- One open report per reporter per item; for ratings the item is (game, player).
drop index if exists public.uq_content_reports_open;
create unique index uq_content_reports_open
  on public.content_reports (reporter_id, target_type, target_id, target_user_id) where status = 'open';

-- Same as 000021, but "open reports on this item" counts per (item, owner).
create or replace function public.admin_reports(p_status public.report_status default 'open', p_limit integer default 100)
returns table (
  id uuid,
  created_at timestamptz,
  target_type public.report_target,
  target_id text,
  target_user_id uuid,
  target_username text,
  reporter_username text,
  reason public.report_reason,
  details text,
  preview text,
  content_exists boolean,
  status public.report_status,
  open_reports_on_target integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_app_admin()) then
    raise exception 'Only app admins can review reports.' using errcode = 'LS001';
  end if;
  return query
  select r.id, r.created_at, r.target_type, r.target_id, r.target_user_id,
         tu.username, ru.username, r.reason, r.details,
         case r.target_type
           when 'review' then (select left(coalesce(v.content, '(score only)'), 400) from public.reviews v where v.id::text = r.target_id)
           when 'list' then (select l.title || coalesce(' — ' || left(l.description, 300), '') from public.lists l where l.id::text = r.target_id)
           when 'rating' then (select 'Rated game #' || q.game_id || ': ' || q.rating || '/100' from public.game_ratings q
                               where q.user_id = r.target_user_id and q.game_id::text = r.target_id)
           when 'user' then tu.username
         end,
         case r.target_type
           when 'review' then exists (select 1 from public.reviews v where v.id::text = r.target_id)
           when 'list' then exists (select 1 from public.lists l where l.id::text = r.target_id)
           when 'rating' then exists (select 1 from public.game_ratings q where q.user_id = r.target_user_id and q.game_id::text = r.target_id)
           when 'user' then tu.id is not null
         end,
         r.status,
         (select count(*)::integer from public.content_reports o
           where o.target_type = r.target_type and o.target_id = r.target_id
             and o.target_user_id = r.target_user_id and o.status = 'open')
  from public.content_reports r
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.profiles ru on ru.id = r.reporter_id
  where r.status = p_status
  order by r.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

-- Same as 000025, but resolving a rating report only touches that player's rating reports.
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
   where target_type = p_target_type and target_id = p_target_id and status = 'open'
     -- A rating report is about one player's rating of the game, not every rating of it.
     and (p_target_type <> 'rating' or target_user_id = p_target_user);
  get diagnostics v_count = row_count;
  perform public.log_admin_action(
    case when p_remove then 'reports.remove' else 'reports.dismiss' end,
    p_target_type::text, p_target_id,
    jsonb_build_object('targetUser', p_target_user, 'reports', v_count, 'note', p_note));
  return v_count;
end;
$$;
