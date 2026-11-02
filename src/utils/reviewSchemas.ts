import { z } from 'zod';

import { isConsistentStoredRating, type StoredRating } from './rating';

export const REVIEW_MAX_LENGTH = 10_000;
export const NOTES_MAX_LENGTH = 10_000;

/**
 * A rating ready to store: canonical numeric (1–100) + the scale and raw value
 * it was entered with. Conversions/ranges live in src/utils/rating.ts.
 */
export const storedRatingSchema = z.custom<StoredRating>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    'numeric' in value &&
    'inputScale' in value &&
    'input' in value &&
    isConsistentStoredRating(value as StoredRating),
  { message: 'Enter a valid rating' },
);

export const reviewFormSchema = z
  .object({
    gameId: z.number({ error: 'Pick a game to review' }).int().positive('Pick a game to review'),
    rating: storedRatingSchema.nullable(),
    content: z.string().trim().max(REVIEW_MAX_LENGTH, `Keep it under ${REVIEW_MAX_LENGTH.toLocaleString()} characters`),
    status: z.enum(['draft', 'published']),
  })
  // Mirrors DB check `reviews_published_has_rating`.
  .refine((r) => r.status === 'draft' || r.rating !== null, {
    path: ['rating'],
    message: 'Give the game a rating before publishing',
  })
  // A draft with nothing in it is pointless; a published quick review may be rating-only.
  .refine((r) => r.status === 'published' || r.rating !== null || r.content.length > 0, {
    path: ['content'],
    message: 'Add a rating or some notes to save a draft',
  });

export type ReviewFormInput = z.input<typeof reviewFormSchema>;
export type ReviewFormValues = z.output<typeof reviewFormSchema>;

export const slotDetailsSchema = z.object({
  notes: z.string().trim().max(NOTES_MAX_LENGTH, `Keep notes under ${NOTES_MAX_LENGTH.toLocaleString()} characters`),
  preliminaryScore: storedRatingSchema.nullable(),
});

export type SlotDetailsValues = z.output<typeof slotDetailsSchema>;
