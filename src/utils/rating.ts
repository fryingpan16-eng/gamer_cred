/**
 * Pure rating conversions. Everything derives from RATING_TIERS / F_STAR_BANDS
 * in src/constants/ratingRubric.ts — no ranges are hardcoded here.
 *
 *   numeric → other scales: exact, by rubric range.
 *   other scales → numeric: the TOP of the input's range, except that S** is
 *   only reachable via numeric 100 or picking the S** tier (5★ / rounded 10 → S = 99).
 */
import {
  F_STAR_BANDS,
  NOT_GOOD,
  NUMERIC_MAX,
  NUMERIC_MIN,
  RATING_TIERS,
  ROUNDED_VALUES,
  STARS_MAX,
  STARS_MIN,
  STARS_STEP,
  TIER_CODES,
  type RatingScale,
  type RoundedValue,
  type TierCode,
  type TierDefinition,
} from '@/constants/ratingRubric';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** A rating as the user entered it, in one specific scale. */
export type RatingInput =
  | { scale: 'numeric'; value: number }
  | { scale: 'tier'; value: TierCode }
  | { scale: 'stars'; value: number }
  | { scale: 'rounded'; value: RoundedValue };

/** A rating as stored: canonical numeric plus how it was entered. */
export type StoredRating = {
  numeric: number;
  inputScale: RatingScale;
  /** Raw input exactly as entered (e.g. "87", "A+", "4.5", "NOT GOOD"). */
  input: string;
};

/** Every scale's value for one numeric score. */
export type DerivedRating = {
  numeric: number;
  tier: TierCode;
  descriptor: string;
  stars: number;
  rounded: RoundedValue;
  definition: TierDefinition;
};

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

export function isValidNumeric(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= NUMERIC_MIN && value <= NUMERIC_MAX;
}

export function isValidStars(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= STARS_MIN &&
    value <= STARS_MAX &&
    Number.isInteger(value / STARS_STEP)
  );
}

export function isValidTier(value: unknown): value is TierCode {
  return typeof value === 'string' && (TIER_CODES as readonly string[]).includes(value);
}

export function isValidRounded(value: unknown): value is RoundedValue {
  return (ROUNDED_VALUES as readonly unknown[]).includes(value);
}

export function isValidRatingInput(input: RatingInput): boolean {
  switch (input.scale) {
    case 'numeric':
      return isValidNumeric(input.value);
    case 'tier':
      return isValidTier(input.value);
    case 'stars':
      return isValidStars(input.value);
    case 'rounded':
      return isValidRounded(input.value);
  }
}

function assertNumeric(numeric: number): void {
  if (!isValidNumeric(numeric)) throw new RangeError(`Numeric rating must be an integer 1–100, got ${numeric}`);
}

// -----------------------------------------------------------------------------
// numeric → other scales (exact)
// -----------------------------------------------------------------------------

export function tierDefinitionForNumeric(numeric: number): TierDefinition {
  assertNumeric(numeric);
  // Ranges cover 1–100 exactly, so a match always exists.
  return RATING_TIERS.find((t) => numeric >= t.min && numeric <= t.max)!;
}

export function tierDefinition(tier: TierCode): TierDefinition {
  return RATING_TIERS.find((t) => t.tier === tier)!;
}

export function numericToTier(numeric: number): TierCode {
  return tierDefinitionForNumeric(numeric).tier;
}

export function numericToDescriptor(numeric: number): string {
  return tierDefinitionForNumeric(numeric).descriptor;
}

export function numericToStars(numeric: number): number {
  const def = tierDefinitionForNumeric(numeric);
  if (def.stars !== null) return def.stars;
  return F_STAR_BANDS.find((band) => numeric >= band.min && numeric <= band.max)!.stars;
}

export function numericToRounded(numeric: number): RoundedValue {
  return tierDefinitionForNumeric(numeric).rounded;
}

export function deriveAllScales(numeric: number): DerivedRating {
  const definition = tierDefinitionForNumeric(numeric);
  return {
    numeric,
    tier: definition.tier,
    descriptor: definition.descriptor,
    stars: numericToStars(numeric),
    rounded: definition.rounded,
    definition,
  };
}

// -----------------------------------------------------------------------------
// other scales → numeric (top of range; S** only explicitly)
// -----------------------------------------------------------------------------

/** Numeric ranges that may be targeted by coarse (stars / rounded) input. */
function coarseTargets(): { min: number; max: number; stars: number; rounded: RoundedValue }[] {
  return RATING_TIERS.filter((t) => !t.explicitOnly).flatMap((t) =>
    t.stars !== null
      ? [{ min: t.min, max: t.max, stars: t.stars, rounded: t.rounded }]
      : F_STAR_BANDS.map((band) => ({ ...band, rounded: t.rounded })),
  );
}

export function tierToNumeric(tier: TierCode): number {
  if (!isValidTier(tier)) throw new RangeError(`Unknown tier: ${String(tier)}`);
  return tierDefinition(tier).max;
}

export function starsToNumeric(stars: number): number {
  if (!isValidStars(stars)) throw new RangeError(`Stars must be 0.5–5 in half steps, got ${stars}`);
  return Math.max(...coarseTargets().filter((t) => t.stars === stars).map((t) => t.max));
}

export function roundedToNumeric(rounded: RoundedValue): number {
  if (!isValidRounded(rounded)) throw new RangeError(`Rounded must be 5–10 or "${NOT_GOOD}", got ${String(rounded)}`);
  return Math.max(...coarseTargets().filter((t) => t.rounded === rounded).map((t) => t.max));
}

export function ratingInputToNumeric(input: RatingInput): number {
  switch (input.scale) {
    case 'numeric':
      assertNumeric(input.value);
      return input.value;
    case 'tier':
      return tierToNumeric(input.value);
    case 'stars':
      return starsToNumeric(input.value);
    case 'rounded':
      return roundedToNumeric(input.value);
  }
}

// -----------------------------------------------------------------------------
// Raw input <-> text (as stored in *_input columns)
// -----------------------------------------------------------------------------

export function serializeRatingInput(input: RatingInput): string {
  return String(input.value);
}

/** Parses a stored raw input; returns null when it is not valid for that scale. */
export function parseRatingInput(scale: RatingScale, raw: string): RatingInput | null {
  const text = raw.trim();
  switch (scale) {
    case 'numeric': {
      const value = /^\d+$/.test(text) ? Number(text) : NaN;
      return isValidNumeric(value) ? { scale, value } : null;
    }
    case 'stars': {
      const value = /^\d+(\.5|\.0)?$/.test(text) ? Number(text) : NaN;
      return isValidStars(value) ? { scale, value } : null;
    }
    case 'tier':
      return isValidTier(text) ? { scale, value: text } : null;
    case 'rounded': {
      if (text.toUpperCase() === NOT_GOOD) return { scale, value: NOT_GOOD };
      const value = /^\d+$/.test(text) ? Number(text) : NaN;
      return isValidRounded(value) ? { scale, value } : null;
    }
  }
}

/** Builds the stored form of a user's input (canonical numeric + exact raw input). */
export function toStoredRating(input: RatingInput): StoredRating {
  if (!isValidRatingInput(input)) throw new RangeError(`Invalid ${input.scale} rating: ${String(input.value)}`);
  return { numeric: ratingInputToNumeric(input), inputScale: input.scale, input: serializeRatingInput(input) };
}

/** The value of a numeric score expressed as an input in `scale` (used to prefill pickers). */
export function numericToRatingInput(numeric: number, scale: RatingScale): RatingInput {
  const derived = deriveAllScales(numeric);
  switch (scale) {
    case 'numeric':
      return { scale, value: numeric };
    case 'tier':
      return { scale, value: derived.tier };
    case 'stars':
      return { scale, value: derived.stars };
    case 'rounded':
      return { scale, value: derived.rounded };
  }
}

/** A stored rating shown in `scale`: the exact raw input when scales match, else derived. */
export function storedRatingInScale(rating: StoredRating, scale: RatingScale): RatingInput {
  if (rating.inputScale === scale) {
    const parsed = parseRatingInput(scale, rating.input);
    if (parsed) return parsed;
  }
  return numericToRatingInput(rating.numeric, scale);
}

// -----------------------------------------------------------------------------
// Display helpers
// -----------------------------------------------------------------------------

/**
 * True when the numeric score was derived from a coarser input rather than
 * typed. S** is never approximate: it always means exactly 100.
 */
export function isNumericApproximate(rating: StoredRating): boolean {
  return rating.inputScale !== 'numeric' && rating.numeric !== NUMERIC_MAX;
}

/** "87" when typed, "~89" when derived from tier/stars/rounded, "100" for S**. */
export function formatNumeric(rating: StoredRating): string {
  return `${isNumericApproximate(rating) ? '~' : ''}${rating.numeric}`;
}

/** "80–89" style range for a tier ("100" for S**). */
export function formatTierRange(tier: TierCode): string {
  const def = tierDefinition(tier);
  return def.min === def.max ? String(def.min) : `${def.min}–${def.max}`;
}

export function formatStars(stars: number): string {
  return `${stars}★`;
}

export function formatRounded(rounded: RoundedValue): string {
  return rounded === NOT_GOOD ? NOT_GOOD : `${rounded}/10`;
}

/** Primary-scale label for a stored rating (exact input when the scales match). */
export function formatRatingInScale(rating: StoredRating, scale: RatingScale): string {
  switch (scale) {
    case 'numeric':
      return formatNumeric(rating);
    case 'tier':
      return storedRatingInScale(rating, 'tier').value as TierCode;
    case 'stars':
      return formatStars(storedRatingInScale(rating, 'stars').value as number);
    case 'rounded':
      return formatRounded(storedRatingInScale(rating, 'rounded').value as RoundedValue);
  }
}

/** Maps nullable DB columns to a StoredRating (null when unrated or inconsistent). */
export function storedRatingFromColumns(
  numeric: number | null | undefined,
  inputScale: RatingScale | null | undefined,
  input: string | null | undefined,
): StoredRating | null {
  if (numeric === null || numeric === undefined || !isValidNumeric(numeric)) return null;
  return { numeric, inputScale: inputScale ?? 'numeric', input: input ?? String(numeric) };
}

/**
 * True when a stored rating is internally consistent: valid numeric, raw input
 * valid for its scale, and the numeric equals what that input converts to.
 */
export function isConsistentStoredRating(rating: StoredRating): boolean {
  if (!isValidNumeric(rating.numeric)) return false;
  const parsed = parseRatingInput(rating.inputScale, rating.input);
  return parsed !== null && ratingInputToNumeric(parsed) === rating.numeric;
}

/** Buckets a 100-slot per-score histogram (index 0 = score 1) into tiers, best → worst. */
export function bucketByTier(countsByNumeric: readonly number[]): { tier: TierCode; count: number }[] {
  return RATING_TIERS.map((t) => {
    let count = 0;
    for (let n = t.min; n <= t.max; n++) count += countsByNumeric[n - 1] ?? 0;
    return { tier: t.tier, count };
  });
}
