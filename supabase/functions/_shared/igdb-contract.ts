/**
 * igdb-proxy request/response contract (the proxy fronts IGDB *and* RAWG).
 *
 * Shared by the Deno Edge Function and the Expo app (the app imports these as
 * types/constants only). Keep this file dependency-free so it runs on both
 * runtimes unchanged.
 */

export type ApiEnvelope<T> = { success: true; data: T; error?: undefined } | { success: false; data?: undefined; error: string };

/**
 * - `games`     → IGDB /games (full-text `search`)
 * - `companies` → IGDB /companies (studios & publishers; name match)
 * - `creators`  → RAWG /creators (directors, writers, composers, …). IGDB v4
 *                 has no people/credits data, so people come from RAWG.
 */
export type IgdbEntityType = 'games' | 'companies' | 'creators';

export const IGDB_ENTITY_TYPES: readonly IgdbEntityType[] = ['games', 'companies', 'creators'];

export const IGDB_SEARCH_LIMITS = {
  minQueryLength: 2,
  maxQueryLength: 80,
  defaultLimit: 20,
  maxLimit: 50,
} as const;

export type IgdbSearchRequest = {
  /** Defaults to 'search'. */
  action?: 'search';
  entity_type: IgdbEntityType;
  query: string;
  limit?: number;
};

/**
 * Batch lookup of games by IGDB id (Now Playing slots, reviews, game pages).
 * Each game is cached individually, so repeated lookups rarely reach IGDB.
 */
export type IgdbLookupRequest = {
  action: 'lookup';
  entity_type: 'games';
  ids: number[];
};

export const IGDB_LOOKUP_MAX_IDS = 50;

/** Full game page record (IGDB metadata + RAWG PC requirements when available). */
export type IgdbDetailRequest = {
  action: 'detail';
  entity_type: 'games';
  id: number;
};

export type GameReleaseDate = {
  platform: string;
  /** ISO date, or null when only a vague date ("Q3 2026", "TBD") is known. */
  date: string | null;
  /** IGDB's human-readable form, e.g. "Nov 16, 2004" or "TBD". */
  human: string;
};

/** One requirement row; `label` is null for free-form lines. */
export type SystemRequirementLine = { label: string | null; value: string };

export type SystemRequirements = {
  minimum: SystemRequirementLine[];
  recommended: SystemRequirementLine[];
  source: 'rawg';
  /** RAWG page used, for attribution links. */
  sourceUrl: string;
};

export type IgdbGameDetail = IgdbGameResult & {
  summary: string | null;
  storyline: string | null;
  screenshotIds: string[];
  artworkIds: string[];
  themes: string[];
  gameModes: string[];
  perspectives: string[];
  publishers: string[];
  engines: string[];
  franchises: string[];
  releaseDates: GameReleaseDate[];
  /** Critic aggregate 0–100 and its source count. */
  criticRating: number | null;
  criticRatingCount: number;
  /** IGDB user rating 0–100 and its vote count. */
  userRating: number | null;
  userRatingCount: number;
  systemRequirements: SystemRequirements | null;
};

export type IgdbDetailResponse = {
  game: IgdbGameDetail;
  cached: boolean;
  fetchedAt: string;
};

/** Studio page: one company plus every catalogue game it developed or published. */
export type IgdbCompanyDetailRequest = {
  action: 'company';
  entity_type: 'companies';
  id: number;
};

/** Most games a studio page lists (developed first, then published). */
export const COMPANY_GAMES_MAX = 1000;

export type CompanyGameRole = 'developer' | 'publisher';

export type IgdbCompanyGame = IgdbGameResult & { roles: CompanyGameRole[] };

export type IgdbCompanyDetail = IgdbCompanyResult & {
  /** Parent company name (e.g. a publisher that owns the studio). */
  parentName: string | null;
  /** Newest first. */
  games: IgdbCompanyGame[];
  /** True when the company credits more than COMPANY_GAMES_MAX games. */
  gamesTruncated: boolean;
};

export type IgdbCompanyDetailResponse = {
  company: IgdbCompanyDetail;
  cached: boolean;
  fetchedAt: string;
};

export type IgdbLookupResponse = {
  entity_type: 'games';
  results: IgdbGameResult[];
  /** Requested ids IGDB does not know (deleted/merged games). */
  missing: number[];
  /** How many of the results were served from igdb_cache. */
  cachedCount: number;
};

/**
 * What kind of catalogue entry a game is (set by the curation filter,
 * supabase/functions/igdb-proxy/curation.ts). Every IGDB game shown in the app
 * is exactly one of these; editions, remasters, mods etc. are filtered out.
 */
export type EntryType = 'game' | 'remake' | 'collection' | 'expansion' | 'dlc';

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  game: 'Game',
  remake: 'Remake',
  collection: 'Collection',
  expansion: 'Expansion',
  dlc: 'DLC',
};

/**
 * Entry types that count as "games" for rankings such as a top-100 list.
 * DLC, expansions and collections get their own categories instead.
 */
export const RANKABLE_ENTRY_TYPES: readonly EntryType[] = ['game', 'remake'];

export function isRankableEntry(entryType: EntryType): boolean {
  return RANKABLE_ENTRY_TYPES.includes(entryType);
}

/** Collections (same-series sets or developer compilations) get their own lists. */
export function isCollectionEntry(entryType: EntryType): boolean {
  return entryType === 'collection';
}

/** Add-on entries that belong to another game. */
export function isAddOnEntry(entryType: EntryType): boolean {
  return entryType === 'dlc' || entryType === 'expansion';
}

export type IgdbGameResult = {
  kind: 'game';
  id: number;
  name: string;
  entryType: EntryType;
  /** For DLC / expansions: the game they belong to (IGDB `parent_game`). */
  parentGame: { id: number; name: string } | null;
  /** For collections: the distinct base games inside (empty otherwise). */
  collectionGames: { id: number; name: string }[];
  slug: string | null;
  /** IGDB image id; build URLs with igdbImageUrl(). */
  coverImageId: string | null;
  releaseYear: number | null;
  /** 0–100 aggregate (critics + users). */
  rating: number | null;
  platforms: string[];
  /**
   * IGDB platform ids in release order (earliest first). The app defaults a
   * rating's "played on" platform to the first one in its catalog. May be
   * missing on records cached before it existed.
   */
  releasePlatformIds?: number[];
  genres: string[];
  developers: string[];
};

export type IgdbCompanyResult = {
  kind: 'company';
  id: number;
  name: string;
  slug: string | null;
  logoImageId: string | null;
  foundedYear: number | null;
  description: string | null;
  developedCount: number;
  publishedCount: number;
};

/** A game-industry person from RAWG. */
export type CreatorResult = {
  kind: 'creator';
  source: 'rawg';
  id: number;
  name: string;
  slug: string | null;
  /** Absolute (already resized) image URL, or null. */
  imageUrl: string | null;
  gamesCount: number;
  /** Roles, e.g. ["director", "writer"]. */
  positions: string[];
  /** A few notable game titles credited to this person. */
  knownFor: string[];
};

export type IgdbResultFor<E extends IgdbEntityType> = E extends 'games'
  ? IgdbGameResult
  : E extends 'companies'
    ? IgdbCompanyResult
    : E extends 'creators'
      ? CreatorResult
      : never;

/** Upstream provider per entity (drives attribution in the UI). */
export const SEARCH_PROVIDER: Record<IgdbEntityType, 'igdb' | 'rawg'> = {
  games: 'igdb',
  companies: 'igdb',
  creators: 'rawg',
};

export type IgdbSearchResponse<E extends IgdbEntityType = IgdbEntityType> = {
  entity_type: E;
  /** Normalized query actually searched (trimmed, collapsed whitespace, lowercased). */
  query: string;
  results: IgdbResultFor<E>[];
  /** True when served from the igdb_cache table (which caches IGDB and RAWG responses). */
  cached: boolean;
  /** ISO timestamp of the upstream IGDB fetch. */
  fetchedAt: string;
};

export function normalizeSearchQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export type IgdbImageSize = 'thumb' | 'micro' | 'cover_small' | 'cover_big' | 'logo_med' | 'screenshot_med' | '720p';

export function igdbImageUrl(imageId: string, size: IgdbImageSize, retina = false): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}${retina ? '_2x' : ''}/${imageId}.jpg`;
}
