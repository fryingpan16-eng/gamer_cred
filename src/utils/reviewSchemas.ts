import { z } from 'zod';

import { containsObjectionable, OBJECTIONABLE_MESSAGE } from './contentFilter';

import { PLATFORMS } from '@/constants/platforms';

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

/** A YYYY-MM-DD date that is a real day, from 1970 up to today. */
export const finishedOnSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD, e.g. 2024-06-30')
  .refine((v) => isRealDay(v), 'That isn’t a real date')
  .refine((v) => v >= '1970-01-01', 'Pick a date from 1970 on')
  .refine((v) => v <= localToday(), 'The finish date can’t be in the future');

/** Today as YYYY-MM-DD in the device's time zone. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isRealDay(v: string): boolean {
  const [y, m, d] = v.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export const reviewFormSchema = z
  .object({
    gameId: z.number({ error: 'Pick a game to review' }).int().positive('Pick a game to review'),
    rating: storedRatingSchema.nullable(),
    content: z
      .string()
      .trim()
      .max(REVIEW_MAX_LENGTH, `Keep it under ${REVIEW_MAX_LENGTH.toLocaleString()} characters`)
      .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE),
    status: z.enum(['draft', 'published']),
    /** Platform played on: a catalog id (src/constants/platforms.ts) or null. */
    platformId: z
      .number()
      .int()
      .nullable()
      .refine((id) => id === null || PLATFORMS.some((p) => p.id === id), 'Pick a platform from the list'),
    /** Another playthrough of a game you've played before (migration 000040). */
    isReplay: z.boolean().default(false),
    /** YYYY-MM-DD the replay was finished; not in the future. */
    finishedOn: finishedOnSchema.nullable().default(null),
  })
  // Mirrors DB check `reviews_published_has_rating`.
  .refine((r) => r.status === 'draft' || r.rating !== null, {
    path: ['rating'],
    message: 'Give the game a rating before publishing',
  })
  // A draft with nothing in it is pointless; a published review may be score-only (existing reviews like that keep working).
  .refine((r) => r.status === 'published' || r.rating !== null || r.content.length > 0, {
    path: ['content'],
    message: 'Add a rating or some notes to save a draft',
  });

export type ReviewFormInput = z.input<typeof reviewFormSchema>;
export type ReviewFormValues = z.output<typeof reviewFormSchema>;

export const slotDetailsSchema = z.object({
  notes: z
    .string()
    .trim()
    .max(NOTES_MAX_LENGTH, `Keep notes under ${NOTES_MAX_LENGTH.toLocaleString()} characters`)
    .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE),
  preliminaryScore: storedRatingSchema.nullable(),
});

export type SlotDetailsValues = z.output<typeof slotDetailsSchema>;

/** A comment on a review (migration 000043): 1–2,000 characters, through the same filter as reviews. */
export const COMMENT_MAX_LENGTH = 2000;

export const commentSchema = z
  .string()
  .trim()
  .min(1, 'Write something first')
  .max(COMMENT_MAX_LENGTH, `Keep it under ${COMMENT_MAX_LENGTH.toLocaleString()} characters`)
  .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE);
