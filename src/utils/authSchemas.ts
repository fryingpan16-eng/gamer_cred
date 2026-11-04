import { z } from 'zod';

import { containsObjectionable, OBJECTIONABLE_MESSAGE } from './contentFilter';
import { DISPLAY_NAME_HINT, isDisplayNameFormatOk, isPermanentNameFormatOk, nameProblemMessage, normalizeDisplayName } from './nameRules';

/**
 * The permanent name (profiles.username, migration 000038). Mirrors the database's
 * character rule; the database also checks look-alikes and reserved names (check_name).
 */
export const usernameSchema = z
  .string()
  .trim()
  .refine(isPermanentNameFormatOk, nameProblemMessage('format', 'permanent'))
  .refine((v) => !containsObjectionable(v.replace(/_/g, ' ')), OBJECTIONABLE_MESSAGE);

/** Display name: any alphabet, changeable once a day. Empty = show the permanent name. */
export const displayNameSchema = z
  .string()
  .transform(normalizeDisplayName)
  .refine((v) => v === '' || isDisplayNameFormatOk(v), DISPLAY_NAME_HINT.replace(' Once a day.', ''))
  .refine((v) => !containsObjectionable(v.replace(/_/g, ' ')), OBJECTIONABLE_MESSAGE);

export const emailSchema = z.email('Enter a valid email address').trim().toLowerCase();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
  /** Terms of Use + Community Guidelines (store requirement for apps with user content). */
  acceptedTerms: z.literal(true, 'Please agree to the Terms of Use and Community Guidelines'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Field → first error message, for wiring into RetroGamingPCInput `error` props. */
export type FieldErrors<T> = Partial<Record<keyof T, string>>;

export function validate<S extends z.ZodType<Record<string, unknown>>>(
  schema: S,
  input: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; errors: FieldErrors<z.infer<S>> } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };

  const errors: FieldErrors<z.infer<S>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof z.infer<S> | undefined;
    if (field !== undefined && errors[field] === undefined) errors[field] = issue.message;
  }
  return { ok: false, errors };
}
