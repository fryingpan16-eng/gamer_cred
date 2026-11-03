import { F_STAR_BANDS, NOT_GOOD, RATING_TIERS, type RoundedValue, type TierCode } from '@/constants/ratingRubric';
import { reviewFormSchema, slotDetailsSchema, storedRatingSchema } from '@/utils/reviewSchemas';
import {
  bucketByTier,
  deriveAllScales,
  formatNumeric,
  formatRatingInScale,
  formatTierRange,
  isConsistentStoredRating,
  isNumericApproximate,
  isValidNumeric,
  isValidStars,
  numericToDescriptor,
  numericToRatingInput,
  numericToRounded,
  numericToStars,
  numericToTier,
  parseRatingInput,
  ratingInputToNumeric,
  roundedToNumeric,
  starsToNumeric,
  storedRatingFromColumns,
  storedRatingInScale,
  tierToNumeric,
  toStoredRating,
  type StoredRating,
} from '@/utils/rating';

describe('rubric integrity', () => {
  it('tier ranges are contiguous and cover 1–100 exactly once', () => {
    const covered = new Map<number, string>();
    for (const t of RATING_TIERS) {
      for (let n = t.min; n <= t.max; n++) {
        expect(covered.has(n)).toBe(false);
        covered.set(n, t.tier);
      }
    }
    expect(covered.size).toBe(100);
    expect(Math.min(...covered.keys())).toBe(1);
    expect(Math.max(...covered.keys())).toBe(100);
  });

  it('F star bands cover exactly the F range', () => {
    const f = RATING_TIERS.find((t) => t.tier === 'F')!;
    expect(F_STAR_BANDS[0]!.min).toBe(f.min);
    expect(F_STAR_BANDS[F_STAR_BANDS.length - 1]!.max).toBe(f.max);
    F_STAR_BANDS.forEach((band, i) => {
      if (i > 0) expect(band.min).toBe(F_STAR_BANDS[i - 1]!.max + 1);
    });
  });

  it('uses the specified badge colours, with S** distinct from S', () => {
    const colors = Object.fromEntries(RATING_TIERS.map((t) => [t.tier, t.color]));
    expect(colors).toEqual({
      'S**': '#7B3FE4',
      S: '#9B7FD4',
      'A+': '#3A7FC1',
      A: '#9CCB8A',
      B: '#D9EBC9',
      C: '#FFE082',
      D: '#F4A96B',
      F: '#E57373',
    });
  });
});

describe('numeric → other scales at every tier boundary', () => {
  // [numeric, tier, descriptor, stars, rounded]
  const cases: [number, TierCode, string, number, RoundedValue][] = [
    [1, 'F', 'Not Good', 0.5, NOT_GOOD],
    [12, 'F', 'Not Good', 0.5, NOT_GOOD],
    [13, 'F', 'Not Good', 1, NOT_GOOD],
    [24, 'F', 'Not Good', 1, NOT_GOOD],
    [25, 'F', 'Not Good', 1.5, NOT_GOOD],
    [36, 'F', 'Not Good', 1.5, NOT_GOOD],
    [37, 'F', 'Not Good', 2, NOT_GOOD],
    [49, 'F', 'Not Good', 2, NOT_GOOD],
    [50, 'D', 'Mediocre', 2.5, 5],
    [59, 'D', 'Mediocre', 2.5, 5],
    [60, 'C', 'Decent', 3, 6],
    [69, 'C', 'Decent', 3, 6],
    [70, 'B', 'Good–Great', 3.5, 7],
    [79, 'B', 'Good–Great', 3.5, 7],
    [80, 'A', 'Excellent–Fantastic', 4, 8],
    [89, 'A', 'Excellent–Fantastic', 4, 8],
    [90, 'A+', 'Classic', 4.5, 9],
    [95, 'A+', 'Classic', 4.5, 9],
    [96, 'S', 'Masterpiece', 5, 10],
    [99, 'S', 'Masterpiece', 5, 10],
    [100, 'S**', 'Masterpiece', 5, 10],
  ];

  it.each(cases)('%i → %s / %s / %f★ / %s', (numeric, tier, descriptor, stars, rounded) => {
    expect(numericToTier(numeric)).toBe(tier);
    expect(numericToDescriptor(numeric)).toBe(descriptor);
    expect(numericToStars(numeric)).toBe(stars);
    expect(numericToRounded(numeric)).toBe(rounded);
    expect(deriveAllScales(numeric)).toMatchObject({ numeric, tier, descriptor, stars, rounded });
  });
});

describe('other scales → numeric (top of range)', () => {
  it.each<[TierCode, number]>([
    ['S**', 100],
    ['S', 99],
    ['A+', 95],
    ['A', 89],
    ['B', 79],
    ['C', 69],
    ['D', 59],
    ['F', 49],
  ])('tier %s → %i', (tier, numeric) => {
    expect(tierToNumeric(tier)).toBe(numeric);
  });

  it.each<[number, number]>([
    [5, 99],
    [4.5, 95],
    [4, 89],
    [3.5, 79],
    [3, 69],
    [2.5, 59],
    [2, 49],
    [1.5, 36],
    [1, 24],
    [0.5, 12],
  ])('%f stars → %i', (stars, numeric) => {
    expect(starsToNumeric(stars)).toBe(numeric);
  });

  it.each<[RoundedValue, number]>([
    [10, 99],
    [9, 95],
    [8, 89],
    [7, 79],
    [6, 69],
    [5, 59],
    [NOT_GOOD, 49],
  ])('rounded %s → %i', (rounded, numeric) => {
    expect(roundedToNumeric(rounded)).toBe(numeric);
  });

  it('round-trips: every top-of-range numeric maps back to the same input', () => {
    for (const stars of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]) expect(numericToStars(starsToNumeric(stars))).toBe(stars);
    for (const r of [5, 6, 7, 8, 9, 10, NOT_GOOD] as RoundedValue[]) expect(numericToRounded(roundedToNumeric(r))).toBe(r);
  });
});

describe('S** is only reachable at exactly 100', () => {
  it('only 100 derives S**', () => {
    for (let n = 1; n <= 100; n++) expect(numericToTier(n) === 'S**').toBe(n === 100);
  });

  it('5 stars and rounded 10 map to S (99), never S**', () => {
    expect(numericToTier(starsToNumeric(5))).toBe('S');
    expect(numericToTier(roundedToNumeric(10))).toBe('S');
  });

  it('choosing S** always stores exactly 100, shown without "~"', () => {
    const stored = toStoredRating({ scale: 'tier', value: 'S**' });
    expect(stored).toEqual({ numeric: 100, inputScale: 'tier', input: 'S**' });
    expect(isNumericApproximate(stored)).toBe(false);
    expect(formatNumeric(stored)).toBe('100');
  });

  it('numeric 100 is S**', () => {
    expect(toStoredRating({ scale: 'numeric', value: 100 })).toEqual({ numeric: 100, inputScale: 'numeric', input: '100' });
  });
});

describe('invalid inputs', () => {
  it.each([0, -1, -50, 101, 1000, 50.5, 0.1, Number.NaN, Number.POSITIVE_INFINITY])('numeric %p is rejected', (value) => {
    expect(isValidNumeric(value)).toBe(false);
    expect(() => toStoredRating({ scale: 'numeric', value })).toThrow(RangeError);
    expect(() => numericToTier(value)).toThrow(RangeError);
  });

  it.each([0, 0.25, 0.75, 5.5, 6, -0.5, 2.4, Number.NaN])('stars %p is rejected', (value) => {
    expect(isValidStars(value)).toBe(false);
    expect(() => starsToNumeric(value)).toThrow(RangeError);
  });

  it('rejects unknown tiers and rounded values', () => {
    expect(() => tierToNumeric('S*' as TierCode)).toThrow(RangeError);
    expect(() => tierToNumeric('E' as TierCode)).toThrow(RangeError);
    expect(() => roundedToNumeric(4 as RoundedValue)).toThrow(RangeError);
    expect(() => roundedToNumeric(11 as RoundedValue)).toThrow(RangeError);
  });

  it('accepts every valid half-star step', () => {
    for (let s = 0.5; s <= 5; s += 0.5) expect(isValidStars(s)).toBe(true);
  });
});

describe('raw input parsing (stored *_input columns)', () => {
  it.each([
    ['numeric', '87', { scale: 'numeric', value: 87 }],
    ['numeric', '100', { scale: 'numeric', value: 100 }],
    ['tier', 'A+', { scale: 'tier', value: 'A+' }],
    ['tier', 'S**', { scale: 'tier', value: 'S**' }],
    ['stars', '4.5', { scale: 'stars', value: 4.5 }],
    ['stars', '3', { scale: 'stars', value: 3 }],
    ['rounded', 'NOT GOOD', { scale: 'rounded', value: NOT_GOOD }],
    ['rounded', '9', { scale: 'rounded', value: 9 }],
  ] as const)('%s "%s" parses', (scale, raw, expected) => {
    expect(parseRatingInput(scale, raw)).toEqual(expected);
  });

  it.each([
    ['numeric', '0'],
    ['numeric', '101'],
    ['numeric', '87.5'],
    ['numeric', '-5'],
    ['numeric', 'abc'],
    ['tier', 'A-'],
    ['stars', '4.25'],
    ['stars', '6'],
    ['rounded', '4'],
    ['rounded', 'bad'],
  ] as const)('%s "%s" is rejected', (scale, raw) => {
    expect(parseRatingInput(scale, raw)).toBeNull();
  });
});

describe('display', () => {
  const fromStars: StoredRating = { numeric: 89, inputScale: 'stars', input: '4' };
  const typed: StoredRating = { numeric: 87, inputScale: 'numeric', input: '87' };

  it('marks numeric derived from coarse input with "~"', () => {
    expect(formatNumeric(fromStars)).toBe('~89');
    expect(formatNumeric(typed)).toBe('87');
  });

  it('shows the exact raw input when the viewer scale matches the input scale', () => {
    expect(storedRatingInScale(fromStars, 'stars')).toEqual({ scale: 'stars', value: 4 });
    expect(formatRatingInScale({ numeric: 49, inputScale: 'rounded', input: 'NOT GOOD' }, 'rounded')).toBe('NOT GOOD');
  });

  it('derives other scales from the canonical numeric', () => {
    expect(formatRatingInScale(typed, 'tier')).toBe('A');
    expect(formatRatingInScale(typed, 'stars')).toBe('4★');
    expect(formatRatingInScale(typed, 'rounded')).toBe('8/10');
    expect(numericToRatingInput(92, 'tier')).toEqual({ scale: 'tier', value: 'A+' });
  });

  it('formats tier ranges', () => {
    expect(formatTierRange('A')).toBe('80–89');
    expect(formatTierRange('S**')).toBe('100');
    expect(formatTierRange('F')).toBe('1–49');
  });

  it('maps DB columns, rejecting out-of-range numerics', () => {
    expect(storedRatingFromColumns(89, 'tier', 'A')).toEqual({ numeric: 89, inputScale: 'tier', input: 'A' });
    expect(storedRatingFromColumns(null, null, null)).toBeNull();
    expect(storedRatingFromColumns(0, 'numeric', '0')).toBeNull();
  });

  it('ratingInputToNumeric dispatches per scale', () => {
    expect(ratingInputToNumeric({ scale: 'tier', value: 'B' })).toBe(79);
    expect(ratingInputToNumeric({ scale: 'stars', value: 1.5 })).toBe(36);
    expect(ratingInputToNumeric({ scale: 'rounded', value: 6 })).toBe(69);
    expect(ratingInputToNumeric({ scale: 'numeric', value: 42 })).toBe(42);
  });
});

describe('stored-rating consistency & aggregation', () => {
  it('accepts consistent stored ratings and rejects tampered ones', () => {
    expect(isConsistentStoredRating({ numeric: 95, inputScale: 'tier', input: 'A+' })).toBe(true);
    expect(isConsistentStoredRating({ numeric: 49, inputScale: 'rounded', input: 'NOT GOOD' })).toBe(true);
    // numeric doesn't match what the raw input converts to
    expect(isConsistentStoredRating({ numeric: 90, inputScale: 'tier', input: 'A+' })).toBe(false);
    // S** must be exactly 100
    expect(isConsistentStoredRating({ numeric: 99, inputScale: 'tier', input: 'S**' })).toBe(false);
    expect(isConsistentStoredRating({ numeric: 100, inputScale: 'stars', input: '5' })).toBe(false);
    expect(isConsistentStoredRating({ numeric: 0, inputScale: 'numeric', input: '0' })).toBe(false);
  });

  it('buckets a 100-score histogram into tiers', () => {
    const counts = Array.from({ length: 100 }, () => 0);
    counts[100 - 1] = 1; // S**
    counts[99 - 1] = 2; // S
    counts[96 - 1] = 1; // S
    counts[89 - 1] = 3; // A
    counts[1 - 1] = 4; // F
    counts[49 - 1] = 1; // F
    expect(Object.fromEntries(bucketByTier(counts).map((b) => [b.tier, b.count]))).toEqual({
      'S**': 1,
      S: 3,
      'A+': 0,
      A: 3,
      B: 0,
      C: 0,
      D: 0,
      F: 5,
    });
  });
});

describe('rating validation schemas', () => {
  const base = { gameId: 1942, content: '', status: 'published' as const, platformId: null };

  it('requires a rating to publish, and a rating or notes for drafts', () => {
    expect(reviewFormSchema.safeParse({ ...base, rating: null }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...base, rating: toStoredRating({ scale: 'stars', value: 4.5 }) }).success).toBe(true);
    expect(reviewFormSchema.safeParse({ ...base, status: 'draft', rating: null }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...base, status: 'draft', rating: null, content: 'notes' }).success).toBe(true);
  });

  it('accepts a catalog platform (incl. PC Handheld) or none, and rejects unknown ids', () => {
    const rating = toStoredRating({ scale: 'numeric', value: 90 });
    expect(reviewFormSchema.safeParse({ ...base, rating, platformId: 167 }).success).toBe(true); // PS5
    expect(reviewFormSchema.safeParse({ ...base, rating, platformId: -1 }).success).toBe(true); // PC Handheld
    expect(reviewFormSchema.safeParse({ ...base, rating, platformId: null }).success).toBe(true);
    expect(reviewFormSchema.safeParse({ ...base, rating, platformId: 99999 }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...base, rating, platformId: 1.5 }).success).toBe(false);
  });

  it('rejects inconsistent or out-of-range stored ratings', () => {
    expect(storedRatingSchema.safeParse({ numeric: 101, inputScale: 'numeric', input: '101' }).success).toBe(false);
    expect(storedRatingSchema.safeParse({ numeric: 87.5, inputScale: 'numeric', input: '87.5' }).success).toBe(false);
    expect(storedRatingSchema.safeParse({ numeric: 89, inputScale: 'stars', input: '4.25' }).success).toBe(false);
    expect(storedRatingSchema.safeParse(87).success).toBe(false);
    expect(slotDetailsSchema.safeParse({ notes: '', preliminaryScore: toStoredRating({ scale: 'rounded', value: NOT_GOOD }) }).success).toBe(true);
  });
});
