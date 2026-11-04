/**
 * Permanent names and display names (migration 000038). These character rules
 * mirror the database (private.permanent_name_format_ok / display_name_format_ok,
 * checked against supabase/tests/fixtures/name_samples.json on both sides). Slurs,
 * staff impersonation and reserved public figures / companies are checked only by
 * the database (`check_name`), so the lists never ship in the app.
 */

export const PERMANENT_NAME_MIN = 3;
export const PERMANENT_NAME_MAX = 24;
export const DISPLAY_NAME_MAX = 32;

/** A–Z, 0–9 and keyboard symbols except @, no spaces, 3–24, at least one letter or number. */
const PERMANENT_CHARS = /^[A-Za-z0-9!#$%^&*()_+=[\]{};:'",.<>/?\\|`~-]{3,24}$/;

export function isPermanentNameFormatOk(name: string): boolean {
  return PERMANENT_CHARS.test(name) && /[A-Za-z0-9]/.test(name);
}

export const PERMANENT_NAME_HINT = '3–24 characters: A–Z, numbers and keyboard symbols. No spaces or @. It can’t be changed later.';
export const DISPLAY_NAME_HINT = 'Up to 32 characters, any language. Letters, numbers, spaces and keyboard symbols (no @ or emoji). Once a day.';

// Letter ranges allowed in display names (same as the database).
const LETTER_RANGES: readonly (readonly [number, number])[] = [
  [192, 214], [216, 246], [248, 591], // Latin
  [880, 1023], // Greek
  [1024, 1327], // Cyrillic
  [1329, 1423], // Armenian
  [1425, 1524], // Hebrew
  [1568, 1747], // Arabic
  [2304, 3583], // Indic scripts
  [3585, 3675], // Thai
  [3713, 3807], // Lao
  [4256, 4351], // Georgian
  [4352, 4607], // Hangul Jamo
  [7680, 7935], // Latin Extended Additional
  [7936, 8191], // Greek Extended
  [12353, 12438], [12441, 12543], // Hiragana, Katakana
  [13312, 19903], [19968, 40959], // CJK
  [44032, 55203], // Hangul
];

const isLetter = (cp: number) => LETTER_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);

/** Expects NFC text (normalizeDisplayName). */
export function isDisplayNameFormatOk(name: string): boolean {
  const chars = [...name];
  if (chars.length < 1 || chars.length > DISPLAY_NAME_MAX) return false;
  if (name !== name.replace(/^ +| +$/g, '') || name.includes('  ')) return false;
  let marks = 0;
  let hasText = false;
  for (let i = 0; i < chars.length; i++) {
    const cp = chars[i]!.codePointAt(0)!;
    if (cp >= 768 && cp <= 879) {
      marks += 1;
      if (marks > 2 || i === 0) return false;
      continue;
    }
    marks = 0;
    if (cp >= 32 && cp <= 126) {
      if (cp === 64) return false;
      if ((cp >= 48 && cp <= 57) || (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) hasText = true;
    } else if (isLetter(cp)) {
      hasText = true;
    } else {
      return false;
    }
  }
  return hasText;
}

/** Trim and compose accents the way the database stores them. */
export function normalizeDisplayName(raw: string): string {
  return raw.trim().replace(/ {2,}/g, ' ').normalize('NFC');
}

/** `check_name` problem codes (migration 000038). */
export type NameProblem = 'format' | 'taken' | 'too_close' | 'language' | 'reserved';

export function nameProblemMessage(problem: NameProblem, kind: 'permanent' | 'display'): string {
  switch (problem) {
    case 'format':
      return kind === 'permanent' ? PERMANENT_NAME_HINT.replace(' It can’t be changed later.', '') : DISPLAY_NAME_HINT.replace(' Once a day.', '');
    case 'taken':
      return 'That name is already taken.';
    case 'too_close':
      return 'That name is too close to another player’s name.';
    case 'language':
      return 'Please keep it clean — that contains language GamerCred doesn’t allow.';
    case 'reserved':
      return 'That name is reserved. Names can’t impersonate staff, public figures or companies.';
  }
}

/** What to show: the display name, or the permanent name when none is set. */
export function shownName(username: string, displayName: string | null | undefined): string {
  return displayName && displayName.length > 0 ? displayName : username;
}
