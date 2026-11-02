/**
 * Mapping between StoredRating and the rating column triplets in the DB
 * (migration 000007). The only place column names for ratings appear.
 */
import type { RatingScale } from '@/constants/ratingRubric';

import { storedRatingFromColumns, type StoredRating } from './rating';

export type ReviewRatingColumns = {
  rating: number | null;
  rating_input_scale: RatingScale | null;
  rating_input: string | null;
};

export type SlotRatingColumns = {
  preliminary_score: number | null;
  preliminary_input_scale: RatingScale | null;
  preliminary_input: string | null;
};

export function reviewRatingColumns(rating: StoredRating | null): ReviewRatingColumns {
  return rating
    ? { rating: rating.numeric, rating_input_scale: rating.inputScale, rating_input: rating.input }
    : { rating: null, rating_input_scale: null, rating_input: null };
}

export function slotRatingColumns(rating: StoredRating | null): SlotRatingColumns {
  return rating
    ? { preliminary_score: rating.numeric, preliminary_input_scale: rating.inputScale, preliminary_input: rating.input }
    : { preliminary_score: null, preliminary_input_scale: null, preliminary_input: null };
}

export function reviewRating(row: Partial<ReviewRatingColumns>): StoredRating | null {
  return storedRatingFromColumns(row.rating, row.rating_input_scale, row.rating_input);
}

export function slotRating(row: Partial<SlotRatingColumns>): StoredRating | null {
  return storedRatingFromColumns(row.preliminary_score, row.preliminary_input_scale, row.preliminary_input);
}
