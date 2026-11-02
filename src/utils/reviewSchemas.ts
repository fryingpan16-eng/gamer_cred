import { z } from 'zod';

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;
export const REVIEW_MAX_LENGTH = 10_000;
export const NOTES_MAX_LENGTH = 10_000;

/** 1–10 whole-number retro meter (DB column is numeric(3,1) 0–10). */
export const scoreSchema = z
  .number()
  .int('Scores are whole numbers')
  .min(SCORE_MIN, `Score must be at least ${SCORE_MIN}`)
  .max(SCORE_MAX, `Score must be at most ${SCORE_MAX}`);

export const reviewFormSchema = z
  .object({
    gameId: z.number({ error: 'Pick a game to review' }).int().positive('Pick a game to review'),
    rating: scoreSchema.nullable(),
    content: z.string().trim().max(REVIEW_MAX_LENGTH, `Keep it under ${REVIEW_MAX_LENGTH.toLocaleString()} characters`),
    status: z.enum(['draft', 'published']),
  })
  // Mirrors DB check `reviews_published_has_rating`.
  .refine((r) => r.status === 'draft' || r.rating !== null, {
    path: ['rating'],
    message: 'Give the game a score before publishing',
  })
  // A draft with nothing in it is pointless; a published quick review may be score-only.
  .refine((r) => r.status === 'published' || r.rating !== null || r.content.length > 0, {
    path: ['content'],
    message: 'Add a score or some notes to save a draft',
  });

export type ReviewFormInput = z.input<typeof reviewFormSchema>;
export type ReviewFormValues = z.output<typeof reviewFormSchema>;

export const slotDetailsSchema = z.object({
  notes: z.string().trim().max(NOTES_MAX_LENGTH, `Keep notes under ${NOTES_MAX_LENGTH.toLocaleString()} characters`),
  preliminaryScore: scoreSchema.nullable(),
});

export type SlotDetailsValues = z.output<typeof slotDetailsSchema>;
