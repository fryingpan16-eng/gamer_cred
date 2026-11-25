/**
 * The game Library (migration 000052): grouping, filtering and sorting for the
 * Library page, and which platforms a game can be owned on. Pure, so it's
 * unit-tested without React Native.
 */
import { generationSortIndex, isConsoleGeneration } from '@/constants/generations';
import { PLATFORMS } from '@/constants/platforms';
import type { StoredRating } from '@/utils/rating';

export type LibraryFormat = 'physical' | 'digital';
export const LIBRARY_FORMAT_LABELS: Record<LibraryFormat, string> = { physical: 'Physical', digital: 'Digital' };

/** One owned copy: a game on one platform. */
export type LibraryEntry = {
  gameId: number;
  platformId: number;
  format: LibraryFormat | null;
  source: string | null;
  addedAt: string;
  /** From the catalogue table; null until the game has been looked up once. */
  name: string | null;
  releaseYear: number | null;
  /** The owned platform's group ('1'–'9', 'pc', 'arcade', 'mobile'), or null. */
  generation: string | null;
  /** The owner's quick rating (one score per game). */
  rating: StoredRating | null;
};

export type LibraryCopy = Pick<LibraryEntry, 'platformId' | 'format' | 'generation' | 'addedAt'>;

/** A game in the Library with every platform it's owned on. */
export type LibraryGame = {
  gameId: number;
  name: string | null;
  releaseYear: number | null;
  /** When the first copy was added. */
  addedAt: string;
  rating: StoredRating | null;
  copies: LibraryCopy[];
};

export type LibrarySort = 'added' | 'title' | 'year';
export const LIBRARY_SORT_LABELS: Record<LibrarySort, string> = { added: 'Date added', title: 'Title', year: 'Release year' };

export type LibraryFilters = {
  platformId: number | null;
  /** A console generation key ('1'–'9'). */
  generation: string | null;
  format: LibraryFormat | null;
  query: string;
};

export const NO_LIBRARY_FILTERS: LibraryFilters = { platformId: null, generation: null, format: null, query: '' };

/** One row per game, newest-added game first; copies in the order they were added. */
export function groupLibrary(entries: readonly LibraryEntry[]): LibraryGame[] {
  const byGame = new Map<number, LibraryGame>();
  for (const e of entries) {
    const copy: LibraryCopy = { platformId: e.platformId, format: e.format, generation: e.generation, addedAt: e.addedAt };
    const game = byGame.get(e.gameId);
    if (!game) {
      byGame.set(e.gameId, { gameId: e.gameId, name: e.name, releaseYear: e.releaseYear, addedAt: e.addedAt, rating: e.rating, copies: [copy] });
    } else {
      game.copies.push(copy);
      if (e.addedAt < game.addedAt) game.addedAt = e.addedAt;
    }
  }
  const games = [...byGame.values()];
  for (const g of games) g.copies.sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.platformId - b.platformId);
  return games.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || a.gameId - b.gameId);
}

/**
 * Games with at least one copy matching every copy filter (platform,
 * generation and format apply to the SAME copy), and a title match.
 * `nameOf` fills names the catalogue table doesn't have yet.
 */
export function filterLibrary(games: readonly LibraryGame[], filters: LibraryFilters, nameOf: (gameId: number) => string | null = () => null): LibraryGame[] {
  const needle = filters.query.trim().toLowerCase();
  return games.filter((g) => {
    if (needle && !(g.name ?? nameOf(g.gameId) ?? '').toLowerCase().includes(needle)) return false;
    return g.copies.some(
      (c) =>
        (filters.platformId === null || c.platformId === filters.platformId) &&
        (filters.generation === null || c.generation === filters.generation) &&
        (filters.format === null || c.format === filters.format),
    );
  });
}

/** Date added: newest first. Title: A–Z. Release year: newest first, unknown years last. Ties by title. */
export function sortLibrary(games: readonly LibraryGame[], sort: LibrarySort, nameOf: (gameId: number) => string | null = () => null): LibraryGame[] {
  const title = (g: LibraryGame) => g.name ?? nameOf(g.gameId) ?? '';
  const byTitle = (a: LibraryGame, b: LibraryGame) => title(a).localeCompare(title(b), undefined, { sensitivity: 'base' }) || a.gameId - b.gameId;
  const out = [...games];
  if (sort === 'title') return out.sort(byTitle);
  if (sort === 'year') return out.sort((a, b) => (b.releaseYear ?? -Infinity) - (a.releaseYear ?? -Infinity) || byTitle(a, b));
  return out.sort((a, b) => b.addedAt.localeCompare(a.addedAt) || byTitle(a, b));
}

/** Copies (one per game + platform) and distinct games. */
export function libraryCounts(entries: readonly Pick<LibraryEntry, 'gameId'>[]): { games: number; copies: number } {
  return { games: new Set(entries.map((e) => e.gameId)).size, copies: entries.length };
}

/** Platforms present in the Library, for the platform filter (catalogue order, unknown ids last). */
export function libraryPlatformIds(entries: readonly Pick<LibraryEntry, 'platformId'>[]): number[] {
  const present = new Set(entries.map((e) => e.platformId));
  const known = PLATFORMS.map((p) => p.id).filter((id) => present.has(id));
  const unknown = [...present].filter((id) => !known.includes(id)).sort((a, b) => a - b);
  return [...known, ...unknown];
}

/** Console generations present in the Library (Gen 1 → 9). PC, arcade and mobile aren't generations. */
export function libraryGenerations(entries: readonly Pick<LibraryEntry, 'generation'>[]): string[] {
  const present = new Set(entries.flatMap((e) => (e.generation && isConsoleGeneration(e.generation) ? [e.generation] : [])));
  return [...present].sort((a, b) => generationSortIndex(a) - generationSortIndex(b));
}

const CATALOG_IDS = new Set(PLATFORMS.filter((p) => p.id > 0).map((p) => p.id));

/**
 * Platforms a game can be owned on: where it was released per IGDB, plus the
 * platforms of its remasters and other versions (they share its entry), in
 * release order. Only catalogue platforms; GamerCred-only ids (PC Handheld)
 * are never release platforms.
 */
export function ownablePlatformIds(game: {
  releasePlatformIds?: readonly number[];
  remasters?: readonly { platformIds?: readonly number[] }[];
  versions?: readonly { platformIds?: readonly number[] }[];
}): number[] {
  const all = [
    ...(game.releasePlatformIds ?? []),
    ...(game.remasters ?? []).flatMap((r) => r.platformIds ?? []),
    ...(game.versions ?? []).flatMap((v) => v.platformIds ?? []),
  ];
  return [...new Set(all)].filter((id) => CATALOG_IDS.has(id));
}
