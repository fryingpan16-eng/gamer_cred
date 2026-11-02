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

export type IgdbLookupResponse = {
  entity_type: 'games';
  results: IgdbGameResult[];
  /** Requested ids IGDB does not know (deleted/merged games). */
  missing: number[];
  /** How many of the results were served from igdb_cache. */
  cachedCount: number;
};

export type IgdbGameResult = {
  kind: 'game';
  id: number;
  name: string;
  slug: string | null;
  /** IGDB image id; build URLs with igdbImageUrl(). */
  coverImageId: string | null;
  releaseYear: number | null;
  /** 0–100 aggregate (critics + users). */
  rating: number | null;
  platforms: string[];
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
