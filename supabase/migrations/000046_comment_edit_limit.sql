-- =============================================================================
-- gamer_cred — 000046 comment edit limit
--
-- 000043 limited new comments to 60 an hour but left edits unlimited. Edits
-- that change the text now take from their own bucket: 30 per player per hour.
-- Saving the same text again is free (it changes nothing).
-- =============================================================================

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
    if new.content is distinct from old.content then
      if not public.take_rate_limit(old.user_id, 'review_comment_edit', 30, 3600) then
        raise exception 'You''ve edited a lot of comments. Take a break and try again in a bit.' using errcode = 'RC002';
      end if;
      new.edited_at := now();
    else
      new.edited_at := old.edited_at;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.review_comments_before_write() from public, anon, authenticated;
