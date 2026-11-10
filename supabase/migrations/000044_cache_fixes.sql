-- =============================================================================
-- gamer_cred — 000044 IGDB cache fixes
--
-- 1. SECURITY: igdb_cache kept its 000001 "public read" rule (any role, signed
--    out included), so the whole cache could be read through the API, around
--    igdb-proxy's sign-in check and rate limit. The app never reads the table;
--    only igdb-proxy (service role, which bypasses RLS) does. RLS stays on with
--    no policies, and the API roles lose their table grants.
-- 2. The nightly purge kept 30 days, but igdb-proxy serves stale results for up
--    to 60 days when IGDB is down (STALE_MAX_MS). The purge now keeps 60 days.
-- =============================================================================

drop policy if exists "igdb_cache: public read" on public.igdb_cache;
alter table public.igdb_cache enable row level security;
revoke all on public.igdb_cache from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Same job name: reschedules the 000026 job in place.
    perform cron.schedule('gamercred-purge-igdb-cache', '17 4 * * *', $c$select public.purge_igdb_cache('60 days')$c$);
  end if;
exception when others then
  raise notice 'pg_cron scheduling skipped: %', sqlerrm;
end;
$$;
