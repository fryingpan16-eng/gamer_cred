-- =============================================================================
-- gamer_cred — 000048 audit follow-ups (2026-11-11)
--
-- 1. content_reports indexes: reporter_id (deleting an account sets it to null,
--    which scanned the whole table; the only index on it is partial) and
--    target_user_id (removing a user closes their open reports).
-- 2. review_like_info leaves out reviews by players hidden from you (blocked
--    either way), like every other read (000031): no comment counts for them.
-- =============================================================================

-- ---- 1. indexes -------------------------------------------------------------------------------
create index if not exists idx_content_reports_reporter on public.content_reports (reporter_id);
create index if not exists idx_content_reports_target_user on public.content_reports (target_user_id, status);

-- ---- 2. review_like_info: hidden authors ------------------------------------------------------
-- Same as 000043, plus the hidden-author filter.
create or replace function public.review_like_info(p_review_ids uuid[])
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
     and (r.status = 'published' or r.user_id = me.id)
     and not (r.user_id = any (me.hidden));
$$;

revoke execute on function public.review_like_info(uuid[]) from public, anon;
grant execute on function public.review_like_info(uuid[]) to authenticated;
