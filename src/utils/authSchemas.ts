import { z } from 'zod';

/** Mirrors the DB check constraint on profiles.username. */
export const usernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,24}$/, '3–24 characters: letters, numbers, or underscore');

export const emailSchema = z.email('Enter a valid email address').trim().toLowerCase();

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use at most 72 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** Field → first error message, for wiring into SteamInput `error` props. */
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
