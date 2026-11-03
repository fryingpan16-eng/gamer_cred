-- =============================================================================
-- gamer_cred — 000008 platform devices
--
-- Lets a roster entry list the specific hardware a player owns, e.g. the
-- "PC Handheld" entry → {"Steam Deck OLED", "ROG Ally X"}. Free text; the app
-- validates and de-duplicates names (src/utils/profileSchemas.ts).
--
-- "PC Handheld" is a GamerCred-only roster entry: IGDB has no such platform
-- (handhelds run PC games), so it uses a reserved negative platform_id (-1).
-- Negative ids never collide with IGDB's positive platform ids.
-- =============================================================================

alter table public.user_platforms
  add column devices text[] not null default '{}',
  add constraint user_platforms_devices_count check (cardinality(devices) <= 8),
  add constraint user_platforms_devices_length check (char_length(array_to_string(devices, '')) <= 8 * 40);
