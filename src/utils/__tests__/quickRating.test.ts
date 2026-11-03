import {
  nextRatingForTap,
  parseNumericField,
  quickRatingDisplayOrder,
  quickRatingInScale,
  quickRatingKey,
  quickRatingOptions,
  stepRating,
  storedFromStars,
} from '../quickRating';
import { numericToStars, toStoredRating } from '../rating';

describe('quick rating rules (any scale)', () => {
  it('offers every value of each scale, worst → best', () => {
    expect(quickRatingOptions('numeric')).toHaveLength(100);
    expect(quickRatingOptions('stars').map((o) => o.value)).toEqual([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
    expect(quickRatingOptions('tier').map((o) => o.value)).toEqual(['F', 'D', 'C', 'B', 'A', 'A+', 'S', 'S**']);
    expect(quickRatingOptions('rounded').map((o) => o.value)).toEqual(['NOT GOOD', 5, 6, 7, 8, 9, 10]);
    // chips are laid out like the review form: tiers / rounded best first
    expect(quickRatingDisplayOrder('tier')[0]!.value).toBe('S**');
    expect(quickRatingDisplayOrder('stars')[0]!.value).toBe(0.5);
  });

  it('stores the input exactly as entered in the chosen scale', () => {
    expect(nextRatingForTap(null, { scale: 'tier', value: 'A+' })).toEqual(toStoredRating({ scale: 'tier', value: 'A+' }));
    expect(nextRatingForTap(null, { scale: 'rounded', value: 8 })).toMatchObject({ inputScale: 'rounded', input: '8' });
    const stars = storedFromStars(4.5);
    expect(stars).toMatchObject({ inputScale: 'stars', input: '4.5' });
    expect(numericToStars(stars.numeric)).toBe(4.5);
  });

  it('tap sets, a different value changes, the same value clears', () => {
    const set = nextRatingForTap(null, { scale: 'tier', value: 'B' });
    const changed = nextRatingForTap(set, { scale: 'tier', value: 'A' });
    expect(quickRatingInScale(changed, 'tier')).toEqual({ scale: 'tier', value: 'A' });
    expect(nextRatingForTap(changed, { scale: 'tier', value: 'A' })).toBeNull();
  });

  it('a score entered on another scale shows in yours (and tapping it clears)', () => {
    const review = { numeric: 92, inputScale: 'numeric' as const, input: '92' };
    expect(quickRatingInScale(review, 'tier')).toEqual({ scale: 'tier', value: 'A+' });
    expect(quickRatingInScale(review, 'stars')).toEqual({ scale: 'stars', value: 4.5 });
    expect(quickRatingInScale(review, 'rounded')).toEqual({ scale: 'rounded', value: 9 });
    expect(nextRatingForTap(review, { scale: 'rounded', value: 9 })).toBeNull();
  });

  it('steps one value better / worse, clamped; from nothing it starts at the worst', () => {
    expect(stepRating('numeric', { scale: 'numeric', value: 87 }, 1)).toEqual({ scale: 'numeric', value: 88 });
    expect(stepRating('numeric', { scale: 'numeric', value: 100 }, 1)).toEqual({ scale: 'numeric', value: 100 });
    expect(stepRating('tier', { scale: 'tier', value: 'A' }, 1)).toEqual({ scale: 'tier', value: 'A+' });
    expect(stepRating('rounded', null, 1)).toEqual({ scale: 'rounded', value: 'NOT GOOD' });
  });

  it('keyboard: ↑ better, arrows follow the chip layout, Enter sets, Delete clears, Escape resets', () => {
    const b = toStoredRating({ scale: 'tier', value: 'B' });
    expect(quickRatingKey('ArrowUp', 'tier', b, null)).toEqual({ kind: 'preview', input: { scale: 'tier', value: 'A' } });
    // tiers are laid out best-first, so → moves toward worse
    expect(quickRatingKey('ArrowRight', 'tier', b, null)).toEqual({ kind: 'preview', input: { scale: 'tier', value: 'C' } });
    expect(quickRatingKey('ArrowRight', 'stars', storedFromStars(4), null)).toEqual({ kind: 'preview', input: { scale: 'stars', value: 4.5 } });
    expect(quickRatingKey('End', 'rounded', null, null)).toEqual({ kind: 'preview', input: { scale: 'rounded', value: 10 } });
    expect(quickRatingKey('Enter', 'tier', b, { scale: 'tier', value: 'S' })).toEqual({
      kind: 'commit',
      value: toStoredRating({ scale: 'tier', value: 'S' }),
    });
    expect(quickRatingKey('Enter', 'tier', b, null)).toEqual({ kind: 'ignore' });
    expect(quickRatingKey('Delete', 'tier', b, null)).toEqual({ kind: 'commit', value: null });
    expect(quickRatingKey('Escape', 'tier', b, { scale: 'tier', value: 'S' })).toEqual({ kind: 'reset' });
  });

  it('1–100 field accepts whole numbers in range only', () => {
    expect(parseNumericField(' 87 ')).toBe(87);
    expect(parseNumericField('100')).toBe(100);
    expect(parseNumericField('0')).toBeNull();
    expect(parseNumericField('101')).toBeNull();
    expect(parseNumericField('8.5')).toBeNull();
    expect(parseNumericField('')).toBeNull();
  });
});
