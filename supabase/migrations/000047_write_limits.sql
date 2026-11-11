-- =============================================================================
-- gamer_cred — 000047 write limits (audit, 2026-11-10)
--
-- 1. Hourly caps on new rows other players see or act on. Since 000040 a
--    player can publish any number of replay reviews of one game, so a script
--    could flood the feeds; reports, friend requests and lists had no cap
--    either. Generous for people, tight for scripts (per player, per hour):
--      reviews 30 · lists 20 · reports 30 · friend requests 60
--    Only the caller's own rows count (RLS rejects the rest anyway); service
--    role writes (merges, admin tools) and guests (refused by RLS) are skipped.
-- 2. game_merges: reads need a session, like every other table (000026).
-- =============================================================================

-- ---- 1. hourly caps ---------------------------------------------------------------------------
-- tg_argv: owner column, bucket, limit per hour, message.
create or replace function private.hourly_insert_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (to_jsonb(new) ->> tg_argv[0])::uuid;
begin
  if v_user is null or v_user is distinct from auth.uid() or public.is_guest() then
    return new;
  end if;
  if not public.take_rate_limit(v_user, tg_argv[1], tg_argv[2]::integer, 3600) then
    raise exception '%', tg_argv[3] using errcode = 'RL001';
  end if;
  return new;
end;
$$;

revoke all on function private.hourly_insert_limit() from public, anon, authenticated;

drop trigger if exists reviews_hourly_limit on public.reviews;
create trigger reviews_hourly_limit before insert on public.reviews
  for each row execute function private.hourly_insert_limit(
    'user_id', 'review_insert', '30', 'You''ve written a lot of reviews this hour. Try again in a bit.');

drop trigger if exists lists_hourly_limit on public.lists;
create trigger lists_hourly_limit before insert on public.lists
  for each row execute function private.hourly_insert_limit(
    'user_id', 'list_insert', '20', 'You''ve made a lot of lists this hour. Try again in a bit.');

drop trigger if exists content_reports_hourly_limit on public.content_reports;
create trigger content_reports_hourly_limit before insert on public.content_reports
  for each row execute function private.hourly_insert_limit(
    'reporter_id', 'report_insert', '30', 'You''ve sent a lot of reports this hour. Try again in a bit.');

drop trigger if exists friendships_hourly_limit on public.friendships;
create trigger friendships_hourly_limit before insert on public.friendships
  for each row execute function private.hourly_insert_limit(
    'user_id', 'friend_request', '60', 'You''ve sent a lot of friend requests this hour. Try again in a bit.');

-- ---- 2. game_merges: signed-in reads ----------------------------------------------------------
drop policy if exists "game_merges: public read" on public.game_merges;
create policy "game_merges: read" on public.game_merges for select to authenticated using (true);
revoke all on public.game_merges from anon;
