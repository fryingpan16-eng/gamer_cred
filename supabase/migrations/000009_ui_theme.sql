-- =============================================================================
-- gamer_cred — 000009 UI colour theme preference
--
-- The RetroGamingPC look in a choice of palettes. Palette values live in the
-- app (src/constants/themePalettes.json); the DB only stores the choice so it
-- follows the user across devices.
-- =============================================================================

create type public.ui_theme as enum ('olive', 'blue', 'red', 'yellow', 'pink');

alter table public.profiles
  add column ui_theme public.ui_theme not null default 'olive';
