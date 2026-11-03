/**
 * Objectionable-text filter (store requirement for user-generated content:
 * Apple App Review 1.2 "a method for filtering objectionable material").
 *
 * Uses the open-source `obscenity` English dataset (slurs and profanity,
 * catching l33t-speak, spacing and repeated-letter tricks). It runs in the Zod
 * schemas for everything other people can read — usernames, list titles and
 * descriptions, review text and Now Playing notes — so offending text is
 * stopped before it is saved. Anything that gets past it can be reported and
 * removed by an admin.
 */
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';

/**
 * Tuned for games: "dick" is dropped (Dick Grayson, Philip K. Dick) and words
 * that merely contain a flagged string are allowed. Add to ALLOWED_TERMS when
 * a real title or name is caught (a test covers common ones).
 */
const ALLOWED_TERMS = ['cockpit', 'cockpits', 'shiitake', 'pussycat', 'pussycats', 'pussy willow', 'cocktail', 'cocktails', 'hancock', 'peacock', 'woodcock'];

const dataset = englishDataset.removePhrasesIf((phrase) => phrase.metadata?.originalWord === 'dick');
const built = dataset.build();
// Extend (not replace) the dataset's own allow-list, which already covers e.g. "assassin".
const matcher = new RegExpMatcher({
  ...built,
  ...englishRecommendedTransformers,
  whitelistedTerms: [...(built.whitelistedTerms ?? []), ...ALLOWED_TERMS],
});

export const OBJECTIONABLE_MESSAGE = 'Please keep it clean — that contains language GamerCred doesn’t allow.';

export function containsObjectionable(text: string): boolean {
  return text.trim().length > 0 && matcher.hasMatch(text);
}
