-- =============================================================================
-- gamer_cred — 000003 search & friendship hardening
-- =============================================================================

-- Username substring search (`username ilike '%term%'`) cannot use a btree
-- index; a trigram GIN index keeps user search fast as the community grows.
create extension if not exists pg_trgm with schema extensions;

create index idx_profiles_username_trgm
  on public.profiles using gin (username extensions.gin_trgm_ops);

-- One friendship row per unordered pair: blocks A→B and B→A both existing
-- (friendships_unique_pair only covers the ordered pair).
create unique index uq_friendships_unordered_pair
  on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));

-- Purge helper for stale IGDB search cache entries (uses idx_igdb_cache_updated).
-- Run on a schedule (pg_cron) or manually: select public.purge_igdb_cache('30 days');
create or replace function public.purge_igdb_cache(older_than interval default interval '30 days')
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.igdb_cache where updated_at < now() - older_than returning 1
  )
  select count(*)::integer from deleted;
$$;

revoke all on function public.purge_igdb_cache(interval) from public, anon, authenticated;
