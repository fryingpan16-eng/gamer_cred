-- =============================================================================
-- gamer_cred — 000024 new players rate with stars by default
-- Only the column default changes; existing players keep the scale they chose.
-- (App fallback: DEFAULT_RATING_SCALE in src/constants/ratingRubric.ts.)
-- =============================================================================

alter table public.profiles alter column primary_rating_scale set default 'stars';
