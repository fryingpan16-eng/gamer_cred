import { z } from 'zod';

import { containsObjectionable, OBJECTIONABLE_MESSAGE } from './contentFilter';
import { smartRuleSchema } from './smartLists';

export const LIST_TITLE_MAX = 80;
export const LIST_DESCRIPTION_MAX = 1000;
export const LIST_MAX_GAMES = 250;

/** Create / edit a list (mirrors the checks in migration 000019). */
export const listFormSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Give your list a title.').max(LIST_TITLE_MAX, `Titles can be up to ${LIST_TITLE_MAX} characters.`))
    .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE),
  description: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(LIST_DESCRIPTION_MAX, `Descriptions can be up to ${LIST_DESCRIPTION_MAX} characters.`))
    .refine((v) => !containsObjectionable(v), OBJECTIONABLE_MESSAGE),
  isRanked: z.boolean(),
  isPublic: z.boolean(),
  /** Admins only (migration 000023): fill the list from Gamer Cred ratings by this rule. */
  smartRule: smartRuleSchema.nullable().default(null),
});

export type ListFormValues = z.infer<typeof listFormSchema>;
export type ListFormInput = z.input<typeof listFormSchema>;
