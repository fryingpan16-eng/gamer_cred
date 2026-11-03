-- =============================================================================
-- gamer_cred — 000013 game curation overrides
--
-- Manual decisions for the igdb-proxy curation filter
-- (supabase/functions/igdb-proxy/curation.ts). An override ALWAYS wins over the
-- automated rules:
--   include → the game is a catalogue entry even if the rules would drop it
--   exclude → the game never appears, even if the rules would keep it
--
-- Only the Edge Function (service role) reads this table: RLS is enabled with
-- no policies, so app clients can neither read nor write it. Manage rows from
-- the SQL editor / CLI (see supabase/functions/igdb-proxy/README.md).
-- =============================================================================

create table public.game_overrides (
  igdb_id    bigint primary key,
  action     text not null check (action in ('include', 'exclude')),
  note       text check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);

alter table public.game_overrides enable row level security;

comment on table public.game_overrides is
  'Curation overrides for igdb-proxy. Changes apply within ~5 minutes (function-side cache).';
