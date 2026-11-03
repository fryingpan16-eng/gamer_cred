/**
 * Quick-rating interaction rules (pure, unit-tested). The quick rating is
 * entered in the viewer's primary scale (Settings → rating scale): 1–100,
 * tier, half stars or rounded /10. Like every rating it is stored as the
 * canonical 1–100 score + the input scale + the raw input, so it converts to
 * all four display scales.
 */
import {
  NUMERIC_MAX,
  NUMERIC_MIN,
  ROUNDED_VALUES,
  STARS_MAX,
  STARS_MIN,
  STARS_STEP,
  TIER_CODES,
  type RatingScale,
} from '@/constants/ratingRubric';

import { storedRatingInScale, toStoredRating, type RatingInput, type StoredRating } from './rating';

/** Every value the scale can take, WORST → BEST. */
export function quickRatingOptions(scale: RatingScale): RatingInput[] {
  switch (scale) {
    case 'numeric':
      return Array.from({ length: NUMERIC_MAX - NUMERIC_MIN + 1 }, (_, i) => ({ scale: 'numeric', value: NUMERIC_MIN + i }));
    case 'stars': {
      const out: RatingInput[] = [];
      for (let s = STARS_MIN; s <= STARS_MAX; s += STARS_STEP) out.push({ scale: 'stars', value: s });
      return out;
    }
    case 'tier':
      return [...TIER_CODES].reverse().map((value) => ({ scale: 'tier', value }));
    case 'rounded':
      return [...ROUNDED_VALUES].reverse().map((value) => ({ scale: 'rounded', value }));
  }
}

/**
 * Chip scales are laid out like the review form: tiers and rounded best-first
 * (left → right), stars worst-first. Numeric is a number field, not chips.
 */
export function quickRatingDisplayOrder(scale: RatingScale): RatingInput[] {
  const options = quickRatingOptions(scale);
  return scale === 'tier' || scale === 'rounded' ? options.reverse() : options;
}

const sameInput = (a: RatingInput | null, b: RatingInput | null) =>
  a !== null && b !== null && a.scale === b.scale && String(a.value) === String(b.value);

/** The viewer's rating expressed in `scale` (a review rated 92 shows as "A+", 4.5★, 9/10 or 92). */
export function quickRatingInScale(value: StoredRating | null, scale: RatingScale): RatingInput | null {
  return value === null ? null : storedRatingInScale(value, scale);
}

/** Tapping the value already shown clears the rating; any other value sets it. */
export function nextRatingForTap(current: StoredRating | null, tapped: RatingInput): StoredRating | null {
  return sameInput(quickRatingInScale(current, tapped.scale), tapped) ? null : toStoredRating(tapped);
}

export type KeyOutcome =
  /** Move the keyboard preview to this value. */
  | { kind: 'preview'; input: RatingInput }
  /** Commit this value (null = clear). */
  | { kind: 'commit'; value: StoredRating | null }
  | { kind: 'reset' }
  | { kind: 'ignore' };

/** One step better (+1) or worse (-1) than `from`; from nothing, the first step lands on the worst value. */
export function stepRating(scale: RatingScale, from: RatingInput | null, delta: 1 | -1): RatingInput {
  const options = quickRatingOptions(scale);
  const index = from === null ? -1 : options.findIndex((o) => sameInput(o, from));
  const next = index === -1 ? 0 : Math.min(options.length - 1, Math.max(0, index + delta));
  return options[next]!;
}

/**
 * Keyboard model (web): ↑ better / ↓ worse; ← → move along the chips as laid
 * out; Home/End = worst/best; Enter/Space sets the preview; Delete/Backspace
 * clears; Escape drops the preview.
 */
export function quickRatingKey(key: string, scale: RatingScale, current: StoredRating | null, preview: RatingInput | null): KeyOutcome {
  const base = preview ?? quickRatingInScale(current, scale);
  const bestOnLeft = scale === 'tier' || scale === 'rounded';
  const options = quickRatingOptions(scale);
  switch (key) {
    case 'ArrowUp':
      return { kind: 'preview', input: stepRating(scale, base, 1) };
    case 'ArrowDown':
      return { kind: 'preview', input: stepRating(scale, base, -1) };
    case 'ArrowRight':
      return { kind: 'preview', input: stepRating(scale, base, bestOnLeft ? -1 : 1) };
    case 'ArrowLeft':
      return { kind: 'preview', input: stepRating(scale, base, bestOnLeft ? 1 : -1) };
    case 'Home':
      return { kind: 'preview', input: options[0]! };
    case 'End':
      return { kind: 'preview', input: options[options.length - 1]! };
    case 'Enter':
    case ' ':
      return preview === null ? { kind: 'ignore' } : { kind: 'commit', value: toStoredRating(preview) };
    case 'Delete':
    case 'Backspace':
      return { kind: 'commit', value: null };
    case 'Escape':
      return { kind: 'reset' };
    default:
      return { kind: 'ignore' };
  }
}

/** Parse the 1–100 field: a whole number in range, or null. */
export function parseNumericField(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= NUMERIC_MIN && n <= NUMERIC_MAX ? n : null;
}

/** Kept for callers that build a stars rating directly. */
export function storedFromStars(stars: number): StoredRating {
  return toStoredRating({ scale: 'stars', value: stars });
}
