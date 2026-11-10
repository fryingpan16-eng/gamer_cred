-- =============================================================================
-- gamer_cred — 000043 comments on reviews
--
-- 1. review_comments: a flat thread under each published review (oldest
--    first; "@name" replies are plain text). Any member may comment, the
--    author included; guests read only. No cap on comments per review, but
--    60 per player per hour (take_rate_limit). The writer can edit their
--    comment (edited_at shows "edited"); removal is an admin action from a
--    report (target type 'comment'). Blocked players are hidden both ways.
-- 2. review_comment_likes: private like ♥ (the same rules as review likes):
--    you see your own likes, and the writer sees how many their comment has.
-- 3. review_comments_page: one review's comments, paged.
-- 4. review_like_info also returns each review's comment count (the 💬 on
--    ReviewCard), for guests too.
-- 5. Reports: 'comment' targets; the admin queue previews them and links to
--    their review (context_id); removing one deletes the comment.
-- =============================================================================

-- ---- 1. comments ------------------------------------------------------------------------------
create table if not exists public.review_comments (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at  timestamptz,
  constraint review_comments_content_length check (char_length(btrim(content)) between 1 and 2000)
);

create index if not exists idx_review_comments_review on public.review_comments (review_id, created_at, id);
create index if not exists idx_review_comments_user on public.review_comments (user_id, created_at desc);

alter table public.review_comments enable row level security;

-- Comments on reviews you can see (published; the review's own rules hide blocked authors).
create policy "review_comments: read" on public.review_comments
  for select to authenticated using (
    exists (select 1 from public.reviews r where r.id = review_id and r.status = 'published')
  );
create policy "review_comments: hide blocked" on public.review_comments as restrictive
  for select to authenticated using (not (user_id = any ((select private.hidden_user_ids())::uuid[])));
create policy "review_comments: owner insert" on public.review_comments
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.reviews r
       where r.id = review_id and r.status = 'published'
         and not (r.user_id = any ((select private.hidden_user_ids())::uuid[]))
    )
  );
create policy "review_comments: owner update" on public.review_comments
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "review_comments: members insert" on public.review_comments as restrictive
  for insert to authenticated with check (not (select public.is_guest()));
create policy "review_comments: members update" on public.review_comments as restrictive
  for update to authenticated using (not (select public.is_guest()));
create policy "review_comments: members delete" on public.review_comments as restrictive
  for delete to authenticated using (not (select public.is_guest()));
-- No delete policy: players can't delete comments (admins remove them through reports).

revoke all on public.review_comments from anon;
revoke all on public.review_comments from authenticated;
grant select, insert on public.review_comments to authenticated;
grant update (content) on public.review_comments to authenticated;

create trigger review_comments_reject_objectionable before insert or update of content on public.review_comments
  for each row execute function public.reject_objectionable('content');

-- Server-owned times and ids; "edited" when the text changes; 60 new comments an hour.
create or replace function public.review_comments_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content := btrim(new.content);
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.edited_at := null;
    if not public.take_rate_limit(new.user_id, 'review_comment', 60, 3600) then
      raise exception 'You''ve posted a lot of comments. Take a break and try again in a bit.' using errcode = 'RC001';
    end if;
  else
    new.id := old.id;
    new.review_id := old.review_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.edited_at := case when new.content is distinct from old.content then now() else old.edited_at end;
  end if;
  return new;
end;
$$;

revoke all on function public.review_comments_before_write() from public, anon, authenticated;

create trigger review_comments_before_write before insert or update on public.review_comments
  for each row execute function public.review_comments_before_write();

-- ---- 2. comment likes -------------------------------------------------------------------------
create table if not exists public.review_comment_likes (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.review_comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index if not exists idx_review_comment_likes_comment on public.review_comment_likes (comment_id);

alter table public.review_comment_likes enable row level security;

create policy "review_comment_likes: owner read" on public.review_comment_likes
  for select to authenticated using ((select auth.uid()) = user_id);
-- Only comments you can see, and never your own.
create policy "review_comment_likes: owner insert" on public.review_comment_likes
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.review_comments c where c.id = comment_id and c.user_id <> (select auth.uid()))
  );
create policy "review_comment_likes: owner delete" on public.review_comment_likes
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "review_comment_likes: members insert" on public.review_comment_likes as restrictive
  for insert to authenticated with check (not (select public.is_guest()));
create policy "review_comment_likes: members delete" on public.review_comment_likes as restrictive
  for delete to authenticated using (not (select public.is_guest()));

revoke all on public.review_comment_likes from anon;
revoke all on public.review_comment_likes from authenticated;
grant select, insert, delete on public.review_comment_likes to authenticated;

create or replace function public.review_comment_likes_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;

create trigger review_comment_likes_stamp before insert on public.review_comment_likes
  for each row execute function public.review_comment_likes_stamp();

-- ---- 3. one review's comments -----------------------------------------------------------------
-- Oldest first. like_count only on your own comments (likes are private).
create or replace function public.review_comments_page(p_review_id uuid, p_offset integer default 0, p_limit integer default 50)
returns table (
  id uuid,
  review_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  edited_at timestamptz,
  author_username text,
  author_avatar_url text,
  liked boolean,
  like_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id, private.hidden_user_ids() as hidden)
  select c.id, c.review_id, c.user_id, c.content, c.created_at, c.edited_at, p.username, p.avatar_url,
         exists (select 1 from public.review_comment_likes l where l.comment_id = c.id and l.user_id = me.id),
         case when c.user_id = me.id
              then (select count(*)::integer from public.review_comment_likes l where l.comment_id = c.id)
         end
    from me, public.review_comments c
    join public.reviews r on r.id = c.review_id
    join public.profiles p on p.id = c.user_id
   where me.id is not null
     and c.review_id = p_review_id
     and r.status = 'published'
     and not (r.user_id = any (me.hidden))
     and not (c.user_id = any (me.hidden))
   order by c.created_at, c.id
   offset greatest(coalesce(p_offset, 0), 0)
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

revoke execute on function public.review_comments_page(uuid, integer, integer) from public, anon;
grant execute on function public.review_comments_page(uuid, integer, integer) to authenticated;

-- ---- 4. comment counts with the like info -----------------------------------------------------
drop function if exists public.review_like_info(uuid[]);
create function public.review_like_info(p_review_ids uuid[])
returns table (review_id uuid, liked boolean, like_count integer, comment_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id, private.hidden_user_ids() as hidden)
  select r.id,
         exists (select 1 from public.review_likes l where l.review_id = r.id and l.user_id = me.id),
         case when r.user_id = me.id
              then (select count(*)::integer from public.review_likes l where l.review_id = r.id)
         end,
         case when r.status = 'published'
              then (select count(*)::integer from public.review_comments c
                     where c.review_id = r.id and not (c.user_id = any (me.hidden)))
              else 0
         end
    from me, public.reviews r
   where me.id is not null
     and r.id = any (p_review_ids[1:200])
     and (r.status = 'published' or r.user_id = me.id);
$$;

revoke execute on function public.review_like_info(uuid[]) from public, anon;
grant execute on function public.review_like_info(uuid[]) to authenticated;

-- ---- 5. reports -------------------------------------------------------------------------------
alter type public.report_target add value if not exists 'comment';

-- Same as 000036, plus comments.
create or replace function public.content_reports_set_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  case new.target_type::text
    when 'review' then
      select r.user_id into v_owner from public.reviews r where r.id = private.try_uuid(new.target_id) and r.status = 'published';
    when 'list' then
      select l.user_id into v_owner from public.lists l where l.id = private.try_uuid(new.target_id);
    when 'user' then
      select p.id into v_owner from public.profiles p where p.id = private.try_uuid(new.target_id);
    when 'rating' then
      -- target_id is the game; the rating must really be this player's.
      select q.user_id into v_owner from public.game_ratings q
       where q.game_id = private.try_bigint(new.target_id) and q.user_id = new.target_user_id;
    when 'comment' then
      select c.user_id into v_owner from public.review_comments c where c.id = private.try_uuid(new.target_id);
  end case;
  if v_owner is null then
    raise exception 'That content no longer exists.' using errcode = 'SF007';
  end if;
  new.target_user_id := v_owner;
  return new;
end;
$$;

-- Same as 000036, plus comments and context_id (a comment's review, for "Open").
drop function if exists public.admin_reports(public.report_status, integer);
create function public.admin_reports(p_status public.report_status default 'open', p_limit integer default 100)
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
  open_reports_on_target integer,
  context_id text
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
         case r.target_type::text
           when 'review' then (select left(coalesce(v.content, '(score only)'), 400) from public.reviews v where v.id = private.try_uuid(r.target_id))
           when 'list' then (select l.title || coalesce(' — ' || left(l.description, 300), '') from public.lists l where l.id = private.try_uuid(r.target_id))
           when 'rating' then (select 'Rated game #' || q.game_id || ': ' || q.rating || '/100' from public.game_ratings q
                               where q.user_id = r.target_user_id and q.game_id = private.try_bigint(r.target_id))
           when 'comment' then (select left(c.content, 400) from public.review_comments c where c.id = private.try_uuid(r.target_id))
           when 'user' then tu.username
         end,
         case r.target_type::text
           when 'review' then exists (select 1 from public.reviews v where v.id = private.try_uuid(r.target_id))
           when 'list' then exists (select 1 from public.lists l where l.id = private.try_uuid(r.target_id))
           when 'rating' then exists (select 1 from public.game_ratings q where q.user_id = r.target_user_id and q.game_id = private.try_bigint(r.target_id))
           when 'comment' then exists (select 1 from public.review_comments c where c.id = private.try_uuid(r.target_id))
           when 'user' then tu.id is not null
         end,
         r.status,
         (select count(*)::integer from public.content_reports o
           where o.target_type = r.target_type and o.target_id = r.target_id
             and o.target_user_id = r.target_user_id and o.status = 'open'),
         case when r.target_type::text = 'comment'
              then (select c.review_id::text from public.review_comments c where c.id = private.try_uuid(r.target_id))
         end
  from public.content_reports r
  left join public.profiles tu on tu.id = r.target_user_id
  left join public.profiles ru on ru.id = r.reporter_id
  where r.status = p_status
  order by r.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$$;

revoke execute on function public.admin_reports(public.report_status, integer) from public, anon;
grant execute on function public.admin_reports(public.report_status, integer) to authenticated;

-- Same as 000036, plus comments.
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
    case p_target_type::text
      when 'review' then delete from public.reviews where id = private.try_uuid(p_target_id);
      when 'list' then delete from public.lists where id = private.try_uuid(p_target_id);
      when 'rating' then
        -- A published review needs its score: removing the rating removes that review too.
        delete from public.reviews where user_id = p_target_user and game_id = private.try_bigint(p_target_id);
        delete from public.game_ratings where user_id = p_target_user and game_id = private.try_bigint(p_target_id);
      when 'comment' then delete from public.review_comments where id = private.try_uuid(p_target_id);
      when 'user' then
        raise exception 'Remove users with the account function (it deletes the sign-in too).' using errcode = 'SF004';
    end case;
  end if;
  update public.content_reports
     set status = case when p_remove then 'actioned'::public.report_status else 'dismissed'::public.report_status end,
         resolved_at = now(), resolved_by = auth.uid(), resolution_note = p_note
   where target_type = p_target_type and target_id = p_target_id and status = 'open'
     -- A rating report is about one player's rating of the game, not every rating of it.
     and (p_target_type::text <> 'rating' or target_user_id = p_target_user);
  get diagnostics v_count = row_count;
  perform public.log_admin_action(
    case when p_remove then 'reports.remove' else 'reports.dismiss' end,
    p_target_type::text, p_target_id,
    jsonb_build_object('targetUser', p_target_user, 'reports', v_count, 'note', p_note));
  return v_count;
end;
$$;
