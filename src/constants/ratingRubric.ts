/**
 * GamerCred rating rubric — the single source of truth for every rating scale.
 *
 * The canonical stored value is always the 1–100 numeric score. Tier, stars and
 * rounded values are derived from it (src/utils/rating.ts); nothing else in the
 * app may hardcode these ranges.
 */

export type RatingScale = 'numeric' | 'tier' | 'stars' | 'rounded';

export const RATING_SCALES: readonly RatingScale[] = ['numeric', 'tier', 'stars', 'rounded'];

export const DEFAULT_RATING_SCALE: RatingScale = 'numeric';

export const RATING_SCALE_LABELS: Record<RatingScale, string> = {
  numeric: 'Numeric (1–100)',
  tier: 'Tier (S**–F)',
  stars: 'Stars (½–5)',
  rounded: 'Rounded (5–10)',
};

export type TierCode = 'S**' | 'S' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';

export const NOT_GOOD = 'NOT GOOD' as const;
export type RoundedValue = 5 | 6 | 7 | 8 | 9 | 10 | typeof NOT_GOOD;

export const NUMERIC_MIN = 1;
export const NUMERIC_MAX = 100;
export const STARS_MIN = 0.5;
export const STARS_MAX = 5;
export const STARS_STEP = 0.5;

export type TierDefinition = {
  tier: TierCode;
  /** Inclusive numeric range. */
  min: number;
  max: number;
  descriptor: string;
  /** Stars for the tier; null where the tier is split into STAR_BANDS (F). */
  stars: number | null;
  rounded: RoundedValue;
  /** Badge background and a text colour with sufficient contrast on it. */
  color: string;
  textColor: string;
  /**
   * Only reachable by entering exactly 100 or choosing the tier directly —
   * never by top-of-range mapping from stars or rounded input.
   */
  explicitOnly?: true;
};

/** Ordered best → worst. Ranges are contiguous and cover 1–100 exactly once. */
export const RATING_TIERS: readonly TierDefinition[] = [
  { tier: 'S**', min: 100, max: 100, descriptor: 'Masterpiece', stars: 5, rounded: 10, color: '#7B3FE4', textColor: '#FFFFFF', explicitOnly: true },
  { tier: 'S', min: 96, max: 99, descriptor: 'Masterpiece', stars: 5, rounded: 10, color: '#9B7FD4', textColor: '#1B1530' },
  { tier: 'A+', min: 90, max: 95, descriptor: 'Classic', stars: 4.5, rounded: 9, color: '#3A7FC1', textColor: '#FFFFFF' },
  { tier: 'A', min: 80, max: 89, descriptor: 'Excellent–Fantastic', stars: 4, rounded: 8, color: '#9CCB8A', textColor: '#1C2A16' },
  { tier: 'B', min: 70, max: 79, descriptor: 'Good–Great', stars: 3.5, rounded: 7, color: '#D9EBC9', textColor: '#26331C' },
  { tier: 'C', min: 60, max: 69, descriptor: 'Decent', stars: 3, rounded: 6, color: '#FFE082', textColor: '#3A2F00' },
  { tier: 'D', min: 50, max: 59, descriptor: 'Mediocre', stars: 2.5, rounded: 5, color: '#F4A96B', textColor: '#3A1F07' },
  { tier: 'F', min: 1, max: 49, descriptor: 'Not Good', stars: null, rounded: NOT_GOOD, color: '#E57373', textColor: '#3A0E0E' },
];

/** F (1–49) is split into four star bands; every other tier has one star value. */
export const F_STAR_BANDS: readonly { min: number; max: number; stars: number }[] = [
  { min: 1, max: 12, stars: 0.5 },
  { min: 13, max: 24, stars: 1 },
  { min: 25, max: 36, stars: 1.5 },
  { min: 37, max: 49, stars: 2 },
];

export const TIER_CODES: readonly TierCode[] = RATING_TIERS.map((t) => t.tier);

/** Rounded picker order (best → worst). */
export const ROUNDED_VALUES: readonly RoundedValue[] = [10, 9, 8, 7, 6, 5, NOT_GOOD];
