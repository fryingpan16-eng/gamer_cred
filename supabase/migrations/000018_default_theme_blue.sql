-- =============================================================================
-- gamer_cred — 000018 blue is the default colour theme
-- New profiles start on blue. Changes the column DEFAULT only: existing
-- profiles keep whatever is stored.
-- =============================================================================
alter table public.profiles alter column ui_theme set default 'blue';
