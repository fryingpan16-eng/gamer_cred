/**
 * Smart lists (migration 000023, admins only): a list that stores a RULE and
 * fills itself from Gamer Cred ratings. The database reads the same rule shape.
 */
import { z } from 'zod';

import { platformInfo } from '@/constants/platforms';

export const SMART_LIST_MAX = 500;

export const SMART_ENTRY_TYPES = [
  { key: 'game', label: 'Games', plural: 'games' },
  { key: 'expansion', label: 'Expansions', plural: 'expansions' },
  { key: 'dlc', label: 'DLC', plural: 'DLC' },
  { key: 'remake', label: 'Remakes', plural: 'remakes' },
  { key: 'collection', label: 'Collections', plural: 'collections' },
] as const;
export type SmartEntryType = (typeof SMART_ENTRY_TYPES)[number]['key'];

/** Tier labels of the rounded average (S includes a perfect 100). */
export const SMART_TIERS = ['S', 'A+', 'A', 'B', 'C', 'D', 'F'] as const;
export type SmartTier = (typeof SMART_TIERS)[number];

/** IGDB genre names (the values stored in games.genres), with short chip labels. */
export const SMART_GENRES = [
  { value: 'Adventure', label: 'Adventure' },
  { value: 'Arcade', label: 'Arcade' },
  { value: 'Card & Board Game', label: 'Card & Board' },
  { value: 'Fighting', label: 'Fighting' },
  { value: "Hack and slash/Beat 'em up", label: 'Hack & Slash' },
  { value: 'Indie', label: 'Indie' },
  { value: 'MOBA', label: 'MOBA' },
  { value: 'Music', label: 'Music' },
  { value: 'Pinball', label: 'Pinball' },
  { value: 'Platform', label: 'Platformer' },
  { value: 'Point-and-click', label: 'Point & Click' },
  { value: 'Puzzle', label: 'Puzzle' },
  { value: 'Quiz/Trivia', label: 'Quiz' },
  { value: 'Racing', label: 'Racing' },
  { value: 'Real Time Strategy (RTS)', label: 'RTS' },
  { value: 'Role-playing (RPG)', label: 'RPG' },
  { value: 'Shooter', label: 'Shooter' },
  { value: 'Simulator', label: 'Simulator' },
  { value: 'Sport', label: 'Sport' },
  { value: 'Strategy', label: 'Strategy' },
  { value: 'Tactical', label: 'Tactical' },
  { value: 'Turn-based strategy (TBS)', label: 'Turn-based' },
  { value: 'Visual Novel', label: 'Visual Novel' },
] as const;

const GENRE_VALUES = SMART_GENRES.map((g) => g.value) as [string, ...string[]];
const YEAR_MIN = 1950;
const YEAR_MAX = 2100;
const year = z.number().int().min(YEAR_MIN, 'Use a year from 1950 on.').max(YEAR_MAX, 'That year is too far ahead.').nullable();

/** What a smart list ranks by (likes: migration 000029). */
export const SMART_RANK_BY = [
  { key: 'average', label: 'Gamer Cred average' },
  { key: 'likes', label: '♥ Likes' },
] as const;
export type SmartRankBy = (typeof SMART_RANK_BY)[number]['key'];

export const smartRuleSchema = z
  .object({
    /** Older rules (before likes) have no rankBy: they rank by average. */
    rankBy: z.enum(['average', 'likes']).default('average'),
    entryTypes: z
      .array(z.enum(SMART_ENTRY_TYPES.map((t) => t.key) as [SmartEntryType, ...SmartEntryType[]]))
      .min(1, 'Pick at least one type.'),
    tiers: z.array(z.enum(SMART_TIERS)),
    yearFrom: year,
    yearTo: year,
    genres: z.array(z.enum(GENRE_VALUES)),
    platformId: z.number().int().nullable(),
    limit: z.number().int().min(1, 'Show at least 1 game.').max(SMART_LIST_MAX, `Smart lists show up to ${SMART_LIST_MAX} games.`),
  })
  .refine((r) => r.yearFrom === null || r.yearTo === null || r.yearFrom <= r.yearTo, {
    message: '“From” must be before “To”.',
    path: ['yearTo'],
  });

export type SmartRule = z.infer<typeof smartRuleSchema>;

export const DEFAULT_SMART_RULE: SmartRule = {
  rankBy: 'average',
  entryTypes: ['game'],
  tiers: [],
  yearFrom: null,
  yearTo: null,
  genres: [],
  platformId: null,
  limit: SMART_LIST_MAX,
};

/** Rule from the database: anything malformed means "not a smart list" rather than a crash. */
export function parseSmartRule(raw: unknown): SmartRule | null {
  if (raw === null || raw === undefined) return null;
  const parsed = smartRuleSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** What smart_list_games returns. */
export const smartListResultSchema = z.object({
  requirements: z.record(z.string(), z.number()),
  /** When the list was last worked out (lists refresh once a day, migration 000028). */
  computedAt: z.string().optional(),
  games: z.array(
    z.object({
      rank: z.number(),
      gameId: z.number(),
      /** Gamer Cred average; null on a "Most liked" list for a game nobody has rated. */
      average: z.number().nullable(),
      ratingCount: z.number(),
      /** "Most liked" lists only. */
      likeCount: z.number().optional(),
    }),
  ),
});
export type SmartListResult = z.infer<typeof smartListResultSchema>;
export type SmartListGame = SmartListResult['games'][number];

function yearsText(from: number | null, to: number | null): string | null {
  if (from === null && to === null) return null;
  if (from !== null && to !== null) {
    if (from === to) return `${from}`;
    // A whole decade reads as "the 2000s".
    if (from % 10 === 0 && to === from + 9) return `the ${from}s`;
    return `${from}–${to}`;
  }
  return from !== null ? `${from} onward` : `up to ${to}`;
}

/** Plain-English rule, e.g. "Top 500 RPG games · S tier · the 2000s · played on Switch". */
export function describeSmartRule(rule: SmartRule): string {
  const genres = rule.genres.map((g) => SMART_GENRES.find((x) => x.value === g)?.label ?? g);
  const types = SMART_ENTRY_TYPES.filter((t) => rule.entryTypes.includes(t.key)).map((t) => t.plural);
  const head = `${rule.rankBy === 'likes' ? 'Most liked' : 'Top'} ${rule.limit} ${genres.length > 0 ? `${genres.join(' / ')} ` : ''}${types.join(' & ')}`;
  const parts = [
    head,
    rule.tiers.length > 0 ? `${rule.tiers.join(' / ')} tier` : null,
    yearsText(rule.yearFrom, rule.yearTo),
    rule.platformId !== null && rule.rankBy !== 'likes' ? `played on ${platformInfo(rule.platformId).short}` : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

/** The rating bar line, e.g. "Needs 12+ ratings (games) · 4+ (expansions)". */
export function describeRequirements(requirements: Record<string, number>): string {
  const entries = SMART_ENTRY_TYPES.filter((t) => requirements[t.key] !== undefined);
  if (entries.length === 0) return '';
  if (entries.length === 1) return `A game needs ${requirements[entries[0]!.key]}+ ratings to qualify.`;
  return `Needs ${entries.map((t) => `${requirements[t.key]}+ ratings (${t.plural})`).join(' · ')} to qualify.`;
}
