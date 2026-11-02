import { toStoredRating } from '@/utils/rating';
import { reviewRating, reviewRatingColumns, slotRating, slotRatingColumns } from '@/utils/ratingColumns';

describe('rating ↔ DB columns', () => {
  it('round-trips review columns', () => {
    const stored = toStoredRating({ scale: 'tier', value: 'S**' });
    const columns = reviewRatingColumns(stored);
    expect(columns).toEqual({ rating: 100, rating_input_scale: 'tier', rating_input: 'S**' });
    expect(reviewRating(columns)).toEqual(stored);
  });

  it('round-trips Now Playing columns, including clearing', () => {
    const stored = toStoredRating({ scale: 'stars', value: 1.5 });
    expect(slotRating(slotRatingColumns(stored))).toEqual({ numeric: 36, inputScale: 'stars', input: '1.5' });
    expect(slotRatingColumns(null)).toEqual({ preliminary_score: null, preliminary_input_scale: null, preliminary_input: null });
    expect(slotRating(slotRatingColumns(null))).toBeNull();
  });
});
