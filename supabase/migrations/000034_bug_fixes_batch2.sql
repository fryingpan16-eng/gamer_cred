-- =============================================================================
-- gamer_cred — 000034 bug fixes, batch 2 (full code review, 2026-11-03)
--
-- PC specs are public on profiles, but the database text filter (000026) only
-- checked device names. It now checks both.
-- =============================================================================

drop trigger if exists user_platforms_reject_objectionable on public.user_platforms;
create trigger user_platforms_reject_objectionable before insert or update of devices, pc_specs on public.user_platforms
  for each row execute function public.reject_objectionable('devices', 'pc_specs');
