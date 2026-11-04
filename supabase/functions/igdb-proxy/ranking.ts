/**
 * Search result ranking for IGDB games and companies. ORDERING ONLY — which
 * games may appear at all is decided by curation.ts before ranking runs.
 *
 * Order: exact title → title prefix → every query word present → the rest.
 * Within a tier, full games come before collections, expansions and DLC, then
 * the most-rated (most-known) entry wins.
 */
import type { EntryType } from '../_shared/igdb-contract.ts';

/** Within the same title match, add-ons sink below the games they belong to. */
export const ENTRY_PRIORITY: Record<EntryType, number> = { game: 0, remake: 0, collection: 1, expansion: 2, dlc: 3 };

export function normalizeTitle(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** 0 exact · 1 prefix · 2 all words present · 3 other. Lower is better. */
export function titleRank(name: string, query: string): number {
  const n = normalizeTitle(name);
  const q = normalizeTitle(query);
  if (!q) return 3;
  if (n === q) return 0;
  if (n.startsWith(`${q} `) || n.startsWith(q)) return 1;
  const words = q.split(' ');
  return words.every((w) => n.split(' ').includes(w)) ? 2 : 3;
}

type RankableGame = {
  name?: string;
  entryType?: EntryType;
  total_rating_count?: number;
  /** Other titles that should find this game (its remasters' names, remasters.ts). */
  aliases?: readonly string[];
};

/** Best title match across the game's name and its aliases. */
export function bestTitleRank(game: RankableGame, query: string): number {
  return Math.min(...[game.name ?? '', ...(game.aliases ?? [])].map((n) => titleRank(n, query)));
}

export function rankGames<T extends RankableGame>(raw: readonly T[], query: string, limit: number): T[] {
  return raw
    .map((game, index) => ({ game, index }))
    .filter(({ game }) => typeof game.name === 'string')
    .sort(
      (a, b) =>
        bestTitleRank(a.game, query) - bestTitleRank(b.game, query) ||
        ENTRY_PRIORITY[a.game.entryType ?? 'game'] - ENTRY_PRIORITY[b.game.entryType ?? 'game'] ||
        (b.game.total_rating_count ?? 0) - (a.game.total_rating_count ?? 0) ||
        a.index - b.index, // keep IGDB's order otherwise
    )
    .slice(0, limit)
    .map(({ game }) => game);
}

type RankableCompany = { name: string; developedCount: number; publishedCount: number };

/** Companies: same title ranking, then catalogue size; drops empty duplicates when real matches exist. */
export function rankCompanies<T extends RankableCompany>(companies: readonly T[], query: string, limit: number): T[] {
  const size = (c: T) => c.developedCount + c.publishedCount;
  const anyWithCatalogue = companies.some((c) => size(c) > 0);
  return companies
    .filter((c) => !anyWithCatalogue || size(c) > 0)
    .slice()
    .sort((a, b) => titleRank(a.name, query) - titleRank(b.name, query) || size(b) - size(a))
    .slice(0, limit);
}
