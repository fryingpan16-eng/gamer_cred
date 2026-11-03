import { z } from 'zod';

export const LIST_TITLE_MAX = 80;
export const LIST_DESCRIPTION_MAX = 1000;
export const LIST_MAX_GAMES = 250;

/** Create / edit a list (mirrors the checks in migration 000019). */
export const listFormSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Give your list a title.').max(LIST_TITLE_MAX, `Titles can be up to ${LIST_TITLE_MAX} characters.`)),
  description: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(LIST_DESCRIPTION_MAX, `Descriptions can be up to ${LIST_DESCRIPTION_MAX} characters.`)),
  isRanked: z.boolean(),
  isPublic: z.boolean(),
});

export type ListFormValues = z.infer<typeof listFormSchema>;
export type ListFormInput = z.input<typeof listFormSchema>;
