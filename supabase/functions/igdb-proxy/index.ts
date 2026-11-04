/**
 * igdb-proxy — server-side catalogue search with PostgreSQL caching.
 *   games / companies → IGDB      creators (people) → RAWG
 *
 * Request (either form):
 *   GET  /functions/v1/igdb-proxy?entity_type=games&query=half-life&limit=20
 *   POST /functions/v1/igdb-proxy   { "entity_type": "games", "query": "half-life" }
 *
 *   POST … { "action": "lookup", "entity_type": "games", "ids": [1942, 7346] }
 *   GET  …?action=lookup&entity_type=games&ids=1942,7346
 *
 *   POST … { "action": "detail", "entity_type": "games", "id": 1942 }
 *
 *   POST … { "action": "company", "entity_type": "companies", "id": 6037 }   (studio page)
 *
 * Response: ApiEnvelope<IgdbSearchResponse | IgdbLookupResponse | IgdbDetailResponse | IgdbCompanyDetailResponse>
 *
 * Secrets (supabase secrets set …): IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, RAWG_API_KEY
 * Auto-injected by Supabase:        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * The service-role client is used ONLY for igdb_cache reads/writes; RLS keeps
 * that table read-only for app users. Twitch tokens are never persisted (the
 * cache table is publicly readable) — they live in isolate memory only.
 */
import { createClient } from '@supabase/supabase-js';

import { createConcurrencyLimiter } from './concurrency.ts';

import {
  COMPANY_GAMES_MAX,
  IGDB_ENTITY_TYPES,
  IGDB_LOOKUP_MAX_IDS,
  IGDB_SEARCH_LIMITS,
  normalizeSearchQuery,
  SEARCH_PROVIDER,
  type ApiEnvelope,
  type CompanyRef,
  type IgdbCompanyDetail,
  type IgdbCompanyDetailResponse,
  type IgdbCompanyResult,
  type IgdbEntityType,
  type GameReleaseDate,
  type IgdbDetailResponse,
  type IgdbGameDetail,
  type IgdbGameResult,
  type IgdbLookupResponse,
  type IgdbSearchResponse,
} from '../_shared/igdb-contract.ts';

import {
  collectionsFromChildren,
  COLLECTION_CHILD_FIELDS,
  COLLECTION_CHILD_GAME_TYPES,
  curateGames,
  CURATION_FIELDS,
  parentGameOf,
  SEARCH_CANDIDATE_LIMIT,
  searchWhereClause,
  type BundleChild,
  type CollectionInfo,
  type CuratedGame,
  type CurationDeps,
  type OverrideAction,
} from './curation.ts';
import { cacheFreshness, computeRulesVersion, runInBackground, SEARCH_REFRESH_AFTER_MS } from './cache_policy.ts';
import * as curationModule from './curation.ts';
import { rankCompanies, rankGames } from './ranking.ts';
import { releasePlatformOrder } from './platform_order.ts';
import { chunk, companyGameIds, IGDB_PAGE_MAX, tagCompanyGames } from './company_games.ts';
import * as rankingModule from './ranking.ts';
import * as remastersModule from './remasters.ts';
import { mapRemasters, REMASTER_DETAIL_FIELDS, remasterOriginals, type RawRemaster } from './remasters.ts';
import { fetchRawgPcRequirements, RawgError, searchRawgCreators } from './rawg.ts';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
/** How long a cached search counts as fresh. People/credits change rarely, and RAWG's free tier is metered monthly. */
const CACHE_TTL_MS: Record<IgdbEntityType, number> = {
  games: 24 * HOUR_MS,
  companies: 7 * 24 * HOUR_MS,
  creators: 14 * 24 * HOUR_MS,
};
const STALE_MAX_MS = 60 * 24 * HOUR_MS; // serve stale up to 60d if the upstream is down
/** Individual game records (titles, covers) barely change. */
const GAME_RECORD_TTL_MS = 7 * 24 * HOUR_MS;
/** Bundle → "is a real collection" results (curation.ts) rarely change. */
const BUNDLE_CHECK_TTL_MS = 30 * 24 * HOUR_MS;
/** How long an isolate reuses game_overrides before re-reading the table. */
const OVERRIDES_TTL_MS = 5 * 60 * 1000;
const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_VERSION = 'v3'; // bump when result shapes, ranking or curation change (v3: curation filter + entryType)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
} as const;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function respond<T>(status: number, body: ApiEnvelope<T>, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `Server misconfigured: ${name} is not set`);
  return value;
}

// -----------------------------------------------------------------------------
// Request parsing & validation
// -----------------------------------------------------------------------------

type ParsedSearch = { action: 'search'; entityType: IgdbEntityType; query: string; limit: number };
type ParsedLookup = { action: 'lookup'; ids: number[] };
type ParsedDetail = { action: 'detail'; id: number };
type ParsedCompany = { action: 'company'; id: number };
type ParsedRequest = ParsedSearch | ParsedLookup | ParsedDetail | ParsedCompany;

function isEntityType(value: unknown): value is IgdbEntityType {
  return typeof value === 'string' && (IGDB_ENTITY_TYPES as readonly string[]).includes(value);
}

async function parseRequest(req: Request): Promise<ParsedRequest> {
  let raw: Record<string, unknown>;
  if (req.method === 'GET') {
    raw = Object.fromEntries(new URL(req.url).searchParams);
  } else if (req.method === 'POST') {
    try {
      const body: unknown = await req.json();
      if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
      raw = body as Record<string, unknown>;
    } catch {
      throw new HttpError(400, 'Request body must be a JSON object');
    }
  } else {
    throw new HttpError(405, `Method ${req.method} not allowed`);
  }

  const action = raw.action ?? 'search';
  if (action === 'lookup') return parseLookup(raw);
  if (action === 'detail') return parseDetail(raw);
  if (action === 'company') return parseCompany(raw);
  if (action !== 'search') throw new HttpError(400, "action must be 'search', 'lookup', 'detail' or 'company'");

  if (!isEntityType(raw.entity_type)) {
    throw new HttpError(400, `entity_type must be one of: ${IGDB_ENTITY_TYPES.join(', ')}`);
  }
  if (typeof raw.query !== 'string') throw new HttpError(400, 'query must be a string');

  const query = normalizeSearchQuery(raw.query);
  if (query.length < IGDB_SEARCH_LIMITS.minQueryLength) {
    throw new HttpError(400, `query must be at least ${IGDB_SEARCH_LIMITS.minQueryLength} characters`);
  }
  if (query.length > IGDB_SEARCH_LIMITS.maxQueryLength) {
    throw new HttpError(400, `query must be at most ${IGDB_SEARCH_LIMITS.maxQueryLength} characters`);
  }

  const limitRaw = raw.limit === undefined ? IGDB_SEARCH_LIMITS.defaultLimit : Number(raw.limit);
  if (!Number.isInteger(limitRaw) || limitRaw < 1 || limitRaw > IGDB_SEARCH_LIMITS.maxLimit) {
    throw new HttpError(400, `limit must be an integer between 1 and ${IGDB_SEARCH_LIMITS.maxLimit}`);
  }

  return { action: 'search', entityType: raw.entity_type, query, limit: limitRaw };
}

function parseDetail(raw: Record<string, unknown>): ParsedDetail {
  if (raw.entity_type !== 'games') throw new HttpError(400, "detail supports entity_type 'games' only");
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'id must be a positive IGDB game id');
  return { action: 'detail', id };
}

function parseCompany(raw: Record<string, unknown>): ParsedCompany {
  if (raw.entity_type !== 'companies') throw new HttpError(400, "company supports entity_type 'companies' only");
  const id = Number(raw.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'id must be a positive IGDB company id');
  return { action: 'company', id };
}

function parseLookup(raw: Record<string, unknown>): ParsedLookup {
  if (raw.entity_type !== 'games') throw new HttpError(400, "lookup supports entity_type 'games' only");
  // GET passes "1,2,3"; POST passes [1,2,3].
  const list: unknown[] = typeof raw.ids === 'string' ? raw.ids.split(',') : Array.isArray(raw.ids) ? raw.ids : [];
  const ids = [...new Set(list.filter((v) => v !== '').map((v) => Number(v)))];
  if (ids.length === 0) throw new HttpError(400, 'ids must be a non-empty list of IGDB game ids');
  if (ids.length > IGDB_LOOKUP_MAX_IDS) throw new HttpError(400, `ids may contain at most ${IGDB_LOOKUP_MAX_IDS} entries`);
  if (!ids.every((id) => Number.isSafeInteger(id) && id > 0)) throw new HttpError(400, 'ids must be positive integers');
  return { action: 'lookup', ids };
}

// -----------------------------------------------------------------------------
// Twitch OAuth (client credentials) — cached per isolate, refreshed on expiry/401
// -----------------------------------------------------------------------------

let cachedToken: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

async function fetchTwitchToken(): Promise<string> {
  const params = new URLSearchParams({
    client_id: requireEnv('IGDB_CLIENT_ID'),
    client_secret: requireEnv('IGDB_CLIENT_SECRET'),
    grant_type: 'client_credentials',
  });
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: params,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!res.ok) throw new HttpError(502, `Twitch auth failed (${res.status})`);

  const json = (await res.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== 'string' || typeof json.expires_in !== 'number') {
    throw new HttpError(502, 'Twitch auth returned an unexpected response');
  }
  // Refresh a minute early to avoid racing expiry mid-request.
  cachedToken = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
  return json.access_token;
}

function getTwitchToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) return Promise.resolve(cachedToken.value);
  // Deduplicate concurrent refreshes within the isolate.
  tokenRequest ??= fetchTwitchToken().finally(() => {
    tokenRequest = null;
  });
  return tokenRequest;
}

// -----------------------------------------------------------------------------
// IGDB
// -----------------------------------------------------------------------------

/**
 * IGDB allows ~4 requests/second and 8 open requests. Every IGDB call goes
 * through this per-isolate limiter: requests start at most every 250 ms and no
 * more than 8 run at once.
 */
const IGDB_MIN_INTERVAL_MS = 250;
const IGDB_MAX_CONCURRENT = 8;
let igdbNextSlot = 0;
const igdbLimiter = createConcurrencyLimiter(IGDB_MAX_CONCURRENT);

function withIgdbRateLimit<T>(task: () => Promise<T>): Promise<T> {
  return igdbLimiter.run(async () => {
    const now = Date.now();
    const start = Math.max(now, igdbNextSlot);
    igdbNextSlot = start + IGDB_MIN_INTERVAL_MS;
    if (start > now) await new Promise((r) => setTimeout(r, start - now));
    return await task();
  });
}

function igdbRequest<T>(endpoint: string, body: string, retried = false): Promise<T> {
  return withIgdbRateLimit(() => igdbRequestOnce<T>(endpoint, body, retried));
}

async function igdbRequestOnce<T>(endpoint: string, body: string, retried = false): Promise<T> {
  const token = await getTwitchToken(retried);
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: {
      'Client-ID': requireEnv('IGDB_CLIENT_ID'),
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'text/plain',
    },
    body,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (res.status === 401 && !retried) {
    cachedToken = null;
    return igdbRequestOnce<T>(endpoint, body, true);
  }
  if (res.status === 429) throw new HttpError(429, 'IGDB rate limit reached. Try again in a moment.');
  if (!res.ok) throw new HttpError(502, `IGDB request failed (${res.status})`);
  return (await res.json()) as T;
}

/** Apicalypse string literals cannot be escaped reliably; strip quote/backslash characters. */
function apicalypseLiteral(value: string): string {
  return value.replace(/["\\]/g, '').trim();
}

type RawGame = {
  id: number;
  name?: string;
  slug?: string;
  cover?: { image_id?: string };
  first_release_date?: number; // unix seconds
  total_rating?: number;
  total_rating_count?: number;
  /** Curation inputs (curation.ts). */
  game_type?: number;
  version_parent?: number | null;
  parent_game?: { id: number; name?: string } | number | null;
  platforms?: { id?: number; abbreviation?: string; name?: string }[];
  /** Only date + platform id here; the detail query adds the platform names. */
  release_dates?: { date?: number; human?: string; platform?: { id?: number; abbreviation?: string; name?: string } }[];
  genres?: { name?: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { id: number; name?: string } }[];
  external_games?: { external_game_source?: number }[];
};

type RawCompany = {
  id: number;
  name?: string;
  slug?: string;
  logo?: { image_id?: string };
  start_date?: number; // unix seconds
  description?: string;
  developed?: number[];
  published?: number[];
};

function yearFromUnix(seconds: number | undefined): number | null {
  return typeof seconds === 'number' ? new Date(seconds * 1000).getUTCFullYear() : null;
}

function compact(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0))];
}

// CURATION_FIELDS already includes total_rating_count, external games and involved companies.
const GAME_FIELDS = [
  `fields name,slug,cover.image_id,total_rating,${CURATION_FIELDS},`,
  'platforms.id,platforms.abbreviation,platforms.name,release_dates.date,release_dates.platform.id,genres.name;',
].join(' ');

async function searchGames(query: string, limit: number): Promise<IgdbGameResult[]> {
  const q = apicalypseLiteral(query);
  // Pre-filter at IGDB and fetch a wide pool: for broad terms IGDB's own ranking
  // puts fan games first, so official titles only appear deeper in the results.
  // Curation then drops the rest and ranking.ts orders by title match + popularity.
  // Remasters are fetched too, only so their names can find the original (remasters.ts).
  const raw = await igdbRequest<RawGame[]>(
    'games',
    [
      `search "${q}";`,
      GAME_FIELDS,
      `where ${searchWhereClause(await getOverrides(), { withRemasters: true })};`,
      `limit ${SEARCH_CANDIDATE_LIMIT};`,
    ].join(' '),
  );
  const aliases = remasterOriginals(raw);
  const present = new Set(raw.map((g) => g.id));
  const missing = [...aliases.keys()].filter((id) => !present.has(id));
  const originals =
    missing.length > 0
      ? await igdbRequest<RawGame[]>('games', `${GAME_FIELDS} where id = (${missing.join(',')}); limit ${missing.length};`)
      : [];
  const { kept } = await curateGames([...raw, ...originals], curationDeps);
  const withAliases = kept.map((g) => ({ ...g, aliases: aliases.get(g.id) ?? [] }));
  return mapGames(rankGames(withAliases, query, limit));
}

type RawGameDetail = Omit<RawGame, 'involved_companies'> & {
  summary?: string;
  storyline?: string;
  screenshots?: { image_id?: string }[];
  artworks?: { image_id?: string }[];
  themes?: { name?: string }[];
  game_modes?: { name?: string }[];
  player_perspectives?: { name?: string }[];
  game_engines?: { name?: string }[];
  franchises?: { name?: string }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { id: number; name?: string } }[];
  remasters?: (RawRemaster | number)[];
  aggregated_rating?: number;
  aggregated_rating_count?: number;
  rating?: number;
  rating_count?: number;
};

const DETAIL_FIELDS = [
  GAME_FIELDS.replace(/;$/, ','),
  'summary,storyline,screenshots.image_id,artworks.image_id,themes.name,game_modes.name,',
  'player_perspectives.name,game_engines.name,franchises.name,',
  'release_dates.date,release_dates.human,release_dates.platform.abbreviation,release_dates.platform.name,',
  `aggregated_rating,aggregated_rating_count,rating,rating_count,${REMASTER_DETAIL_FIELDS};`,
].join(' ');

const PC_PLATFORM_NAMES = new Set(['PC', 'Mac', 'Linux', 'PC (Microsoft Windows)']);

async function fetchGameDetail(
  id: number,
  reuse?: { requirements: IgdbGameDetail['systemRequirements'] },
): Promise<IgdbGameDetail | null> {
  const raw = await igdbRequest<RawGameDetail[]>('games', `${DETAIL_FIELDS} where id = ${id}; limit 1;`);
  const { kept } = await curateGames(raw, curationDeps);
  const g = kept[0];
  if (!g) return null; // unknown id, or not a catalogue entry (edition, remaster, mod, …)
  const [base] = mapGames([g]);
  if (!base) return null;

  const names = (list: { name?: string }[] | undefined) => compact((list ?? []).map((x) => x.name));
  const images = (list: { image_id?: string }[] | undefined) => compact((list ?? []).map((x) => x.image_id));
  const round = (n: number | undefined) => (typeof n === 'number' ? Math.round(n) : null);
  // One entry per company id, in IGDB's credit order.
  const companies = (role: 'developer' | 'publisher'): CompanyRef[] => [
    ...new Map(
      (g.involved_companies ?? [])
        .filter((ic) => ic[role] && typeof ic.company?.id === 'number' && typeof ic.company.name === 'string')
        .map((ic) => [ic.company!.id, { id: ic.company!.id, name: ic.company!.name! }] as const),
    ).values(),
  ];

  const releaseDates: GameReleaseDate[] = (g.release_dates ?? [])
    .filter((r) => r.human || r.date)
    .map((r) => ({
      platform: r.platform?.abbreviation ?? r.platform?.name ?? 'Unknown',
      date: typeof r.date === 'number' ? new Date(r.date * 1000).toISOString().slice(0, 10) : null,
      human: r.human ?? (typeof r.date === 'number' ? new Date(r.date * 1000).toISOString().slice(0, 10) : 'TBD'),
    }))
    .sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));

  const detail: IgdbGameDetail = {
    ...base,
    summary: g.summary ?? null,
    storyline: g.storyline ?? null,
    screenshotIds: images(g.screenshots).slice(0, 12),
    artworkIds: images(g.artworks).slice(0, 6),
    themes: names(g.themes),
    gameModes: names(g.game_modes),
    perspectives: names(g.player_perspectives),
    publishers: compact((g.involved_companies ?? []).filter((ic) => ic.publisher).map((ic) => ic.company?.name)),
    engines: names(g.game_engines),
    franchises: names(g.franchises),
    releaseDates,
    criticRating: round(g.aggregated_rating),
    criticRatingCount: g.aggregated_rating_count ?? 0,
    userRating: round(g.rating),
    userRatingCount: g.rating_count ?? 0,
    systemRequirements: null,
    developerCompanies: companies('developer'),
    publisherCompanies: companies('publisher'),
    remasters: mapRemasters(g.remasters),
  };

  // PC requirements are best-effort: a RAWG outage or missing key never breaks the page.
  const apiKey = Deno.env.get('RAWG_API_KEY');
  if (reuse) {
    detail.systemRequirements = reuse.requirements;
  } else if (apiKey && detail.platforms.some((p) => PC_PLATFORM_NAMES.has(p))) {
    try {
      detail.systemRequirements = await fetchRawgPcRequirements(detail.slug, detail.name, apiKey, {
        timeoutMs: UPSTREAM_TIMEOUT_MS,
      });
    } catch (error) {
      console.warn('[igdb-proxy] RAWG requirements unavailable', error instanceof Error ? error.message : error);
    }
  }
  return detail;
}

async function fetchGamesByIds(ids: number[]): Promise<IgdbGameResult[]> {
  const raw = await igdbRequest<RawGame[]>('games', `${GAME_FIELDS} where id = (${ids.join(',')}); limit ${ids.length};`);
  // Ids that fail curation are simply not returned (they show up as `missing`).
  const { kept } = await curateGames(raw, curationDeps);
  return mapGames(kept);
}

function mapGames(raw: CuratedGame<RawGame>[]): IgdbGameResult[] {
  return raw
    .filter((g) => typeof g.name === 'string')
    .map((g) => ({
      kind: 'game' as const,
      id: g.id,
      name: g.name!,
      entryType: g.entryType,
      parentGame: parentGameOf(g),
      collectionGames: g.collectionGames,
      slug: g.slug ?? null,
      coverImageId: g.cover?.image_id ?? null,
      releaseYear: yearFromUnix(g.first_release_date),
      rating: typeof g.total_rating === 'number' ? Math.round(g.total_rating) : null,
      platforms: compact((g.platforms ?? []).map((p) => p.abbreviation ?? p.name)),
      releasePlatformIds: releasePlatformOrder(g.release_dates, g.platforms),
      genres: compact((g.genres ?? []).map((x) => x.name)),
      developers: compact((g.involved_companies ?? []).filter((ic) => ic.developer).map((ic) => ic.company?.name)),
    }));
}

async function searchCompanies(query: string, limit: number): Promise<IgdbCompanyResult[]> {
  const q = apicalypseLiteral(query);
  // /companies has no full-text `search`; use case-insensitive substring match,
  // over-fetch, then rank locally (exact → prefix → substring, then catalogue size).
  const raw = await igdbRequest<RawCompany[]>(
    'companies',
    [
      'fields name,slug,logo.image_id,start_date,description,developed,published;',
      `where name ~ *"${q}"*;`,
      `limit ${Math.min(limit * 3, 150)};`,
    ].join(' '),
  );

  const companies = raw
    .filter((c) => typeof c.name === 'string')
    .map((c) => ({
      kind: 'company' as const,
      id: c.id,
      name: c.name!,
      slug: c.slug ?? null,
      logoImageId: c.logo?.image_id ?? null,
      foundedYear: yearFromUnix(c.start_date),
      description: c.description ? c.description.slice(0, 280) : null,
      developedCount: c.developed?.length ?? 0,
      publishedCount: c.published?.length ?? 0,
    }));
  return rankCompanies(companies, query, limit);
}

type RawCompanyDetail = RawCompany & { parent?: { name?: string } | number | null };

/** Studio page: the company record plus every curated game it developed or published. */
async function fetchCompanyDetail(id: number): Promise<IgdbCompanyDetail | null> {
  const [c] = await igdbRequest<RawCompanyDetail[]>(
    'companies',
    `fields name,slug,logo.image_id,start_date,description,developed,published,parent.name; where id = ${id}; limit 1;`,
  );
  if (!c || typeof c.name !== 'string') return null;

  const { ids, truncated } = companyGameIds(c.developed, c.published, COMPANY_GAMES_MAX);
  const where = searchWhereClause(await getOverrides());
  const pages = await Promise.all(
    chunk(ids, IGDB_PAGE_MAX).map((page) =>
      igdbRequest<RawGame[]>('games', `${GAME_FIELDS} where id = (${page.join(',')}) & (${where}); limit ${IGDB_PAGE_MAX};`),
    ),
  );
  const { kept } = await curateGames(pages.flat(), curationDeps);

  return {
    kind: 'company',
    id: c.id,
    name: c.name,
    slug: c.slug ?? null,
    logoImageId: c.logo?.image_id ?? null,
    foundedYear: yearFromUnix(c.start_date),
    description: c.description ?? null,
    developedCount: c.developed?.length ?? 0,
    publishedCount: c.published?.length ?? 0,
    parentName: typeof c.parent === 'object' && c.parent ? (c.parent.name ?? null) : null,
    games: tagCompanyGames(mapGames(kept), c.developed, c.published),
    gamesTruncated: truncated,
  };
}

async function fetchUpstream(entityType: IgdbEntityType, query: string, limit: number): Promise<unknown[]> {
  switch (entityType) {
    case 'games':
      return searchGames(query, limit);
    case 'companies':
      return searchCompanies(query, limit);
    case 'creators':
      try {
        return await searchRawgCreators(query, limit, requireEnv('RAWG_API_KEY'), { timeoutMs: UPSTREAM_TIMEOUT_MS });
      } catch (error) {
        if (error instanceof RawgError) throw new HttpError(error.status, error.message);
        throw error;
      }
  }
}

// -----------------------------------------------------------------------------
// Cache (igdb_cache — shared by IGDB and RAWG; keys are namespaced by entity)
// -----------------------------------------------------------------------------

/** `rulesVersion` is set on IGDB-derived payloads only (RAWG data is unstamped). */
type CachedPayload = { results: unknown[]; fetchedAt: string; rulesVersion?: string };

/**
 * Fingerprint of everything that shapes IGDB results: the curation + ranking
 * modules and this file's query fields / mapping. A deploy that changes any of
 * it expires older cache entries automatically (cache_policy.ts).
 */
let rulesVersionPromise: Promise<string> | null = null;
function getRulesVersion(): Promise<string> {
  rulesVersionPromise ??= computeRulesVersion([
    curationModule,
    rankingModule,
    remastersModule,
    GAME_FIELDS,
    DETAIL_FIELDS,
    mapGames,
    searchGames,
    searchCompanies,
    fetchGameDetail,
  ]);
  return rulesVersionPromise;
}

function cacheClient() {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readCache(
  db: ReturnType<typeof cacheClient>,
  key: string,
): Promise<{ payload: CachedPayload; ageMs: number } | null> {
  const { data, error } = await db.from('igdb_cache').select('data, updated_at').eq('cache_key', key).maybeSingle();
  if (error) {
    console.error('[igdb-proxy] cache read failed', error.message);
    return null;
  }
  if (!data) return null;
  const payload = data.data as CachedPayload | null;
  if (!payload || !Array.isArray(payload.results)) return null;
  return { payload, ageMs: Date.now() - new Date(data.updated_at as string).getTime() };
}

async function writeCache(db: ReturnType<typeof cacheClient>, key: string, payload: CachedPayload): Promise<void> {
  const { error } = await db
    .from('igdb_cache')
    .upsert({ cache_key: key, data: payload, updated_at: new Date().toISOString() }, { onConflict: 'cache_key' });
  if (error) console.error('[igdb-proxy] cache write failed', error.message);
}

/**
 * Collapses identical concurrent cache misses within this isolate into a single
 * upstream call (e.g. several users typing the same popular name at once).
 */
const inflightFetches = new Map<string, Promise<CachedPayload>>();

function fetchAndCacheOnce(
  db: ReturnType<typeof cacheClient>,
  cacheKey: string,
  fetcher: () => Promise<unknown[]>,
  options: { stampRules: boolean },
): Promise<CachedPayload> {
  const existing = inflightFetches.get(cacheKey);
  if (existing) return existing;

  const task = (async () => {
    const payload: CachedPayload = {
      results: await fetcher(),
      fetchedAt: new Date().toISOString(),
      ...(options.stampRules ? { rulesVersion: await getRulesVersion() } : {}),
    };
    await writeCache(db, cacheKey, payload); // empty result sets are cached too
    return payload;
  })().finally(() => inflightFetches.delete(cacheKey));

  inflightFetches.set(cacheKey, task);
  return task;
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Curation dependencies: overrides (game_overrides) + collection checks
// -----------------------------------------------------------------------------

let overridesCache: { at: number; map: ReadonlyMap<number, OverrideAction> } | null = null;

async function getOverrides(): Promise<ReadonlyMap<number, OverrideAction>> {
  if (overridesCache && Date.now() - overridesCache.at < OVERRIDES_TTL_MS) return overridesCache.map;
  const { data, error } = await cacheClient().from('game_overrides').select('igdb_id, action');
  if (error) {
    // Keep serving the last known overrides rather than failing every request.
    console.error('[igdb-proxy] overrides read failed', error.message);
    return overridesCache?.map ?? new Map();
  }
  const map = new Map((data ?? []).map((r) => [Number(r.igdb_id), r.action as OverrideAction]));
  overridesCache = { at: Date.now(), map };
  return map;
}

const bundleCheckKey = (bundleId: number) => `bundle-check:${CACHE_VERSION}:igdb:${bundleId}`;

/**
 * bundle id → is a real collection. Cached per bundle in igdb_cache (30 days);
 * every uncached bundle in a request is resolved with ONE IGDB query.
 */
async function checkCollections(bundleIds: number[]): Promise<ReadonlyMap<number, CollectionInfo>> {
  const db = cacheClient();
  const result = new Map<number, CollectionInfo>();
  const { data: rows } = await db
    .from('igdb_cache')
    .select('cache_key, data, updated_at')
    .in('cache_key', bundleIds.map(bundleCheckKey));
  const rulesVersion = await getRulesVersion();
  for (const row of rows ?? []) {
    const age = Date.now() - new Date(row.updated_at as string).getTime();
    const cached = (row.data as ({ bundleId?: number; rulesVersion?: string } & Partial<CollectionInfo>) | null) ?? {};
    if (
      cacheFreshness({ ageMs: age, ttlMs: BUNDLE_CHECK_TTL_MS, refreshAfterMs: null, rulesVersion: cached.rulesVersion, currentRulesVersion: rulesVersion }) !== 'expired' &&
      typeof cached.bundleId === 'number' &&
      typeof cached.isCollection === 'boolean' &&
      Array.isArray(cached.games)
    ) {
      result.set(cached.bundleId, { isCollection: cached.isCollection, basis: cached.basis ?? null, games: cached.games });
    }
  }

  const unchecked = bundleIds.filter((id) => !result.has(id));
  if (unchecked.length === 0) return result;

  const children = await igdbRequest<BundleChild[]>(
    'games',
    `fields ${COLLECTION_CHILD_FIELDS}; where bundles = (${unchecked.join(',')}) & version_parent = null & game_type = (${COLLECTION_CHILD_GAME_TYPES.join(',')}); limit 500;`,
  );
  const fresh = collectionsFromChildren(unchecked, children);
  const now = new Date().toISOString();
  const { error } = await db.from('igdb_cache').upsert(
    [...fresh].map(([bundleId, info]) => ({ cache_key: bundleCheckKey(bundleId), data: { bundleId, rulesVersion, ...info }, updated_at: now })),
    { onConflict: 'cache_key' },
  );
  if (error) console.error('[igdb-proxy] bundle check cache write failed', error.message);
  for (const [id, value] of fresh) result.set(id, value);
  return result;
}

const curationDeps: CurationDeps = { getOverrides, checkCollections };

/** Overrides added after something was cached still win: re-check excludes on cached results. */
async function withoutExcluded<T extends { id: number }>(games: T[]): Promise<T[]> {
  const overrides = await getOverrides();
  return games.filter((g) => overrides.get(g.id) !== 'exclude');
}

function gameCacheKey(id: number): string {
  return `game:${CACHE_VERSION}:igdb:${id}`;
}

async function cacheGameRecords(
  db: ReturnType<typeof cacheClient>,
  games: IgdbGameResult[],
  fetchedAt: string,
): Promise<void> {
  if (games.length === 0) return;
  const rulesVersion = await getRulesVersion();
  const { error } = await db.from('igdb_cache').upsert(
    games.map((game) => ({ cache_key: gameCacheKey(game.id), data: { results: [game], fetchedAt, rulesVersion }, updated_at: fetchedAt })),
    { onConflict: 'cache_key' },
  );
  if (error) console.error('[igdb-proxy] game record cache write failed', error.message);

  // Durable metadata for the Stats page (migration 000014). igdb_cache is
  // disposable; public.games keeps what the stats_* SQL functions join on.
  const { error: gamesError } = await db.from('games').upsert(
    games.map((game) => ({
      igdb_id: game.id,
      name: game.name,
      release_year: game.releaseYear,
      community_rating: game.rating,
      genres: game.genres,
      developers: game.developers,
      entry_type: game.entryType,
      updated_at: fetchedAt,
    })),
    { onConflict: 'igdb_id' },
  );
  if (gamesError) console.error('[igdb-proxy] games table write failed', gamesError.message);
}

/**
 * Batch game lookup: serve every fresh per-game cache row, fetch only the
 * misses from IGDB in one request, and cache each game individually.
 */
async function handleLookup(ids: number[]): Promise<Response> {
  const db = cacheClient();
  const { data: rows, error } = await db
    .from('igdb_cache')
    .select('cache_key, data, updated_at')
    .in('cache_key', ids.map(gameCacheKey));
  if (error) console.error('[igdb-proxy] lookup cache read failed', error.message);

  const rulesVersion = await getRulesVersion();
  const fresh = new Map<number, IgdbGameResult>();
  const stale = new Map<number, IgdbGameResult>();
  for (const row of rows ?? []) {
    const payload = row.data as CachedPayload | null;
    const game = payload?.results?.[0] as IgdbGameResult | undefined;
    if (!game) continue;
    const ageMs = Date.now() - new Date(row.updated_at as string).getTime();
    const state = cacheFreshness({ ageMs, ttlMs: GAME_RECORD_TTL_MS, refreshAfterMs: null, rulesVersion: payload?.rulesVersion, currentRulesVersion: rulesVersion });
    // Records from older rules / past TTL are refetched, kept only as an outage fallback.
    (state === 'expired' ? stale : fresh).set(game.id, game);
  }

  const toFetch = ids.filter((id) => !fresh.has(id));
  const fetched = new Map<number, IgdbGameResult>();
  if (toFetch.length > 0) {
    try {
      const games = await fetchGamesByIds(toFetch);
      const fetchedAt = new Date().toISOString();
      for (const game of games) fetched.set(game.id, game);
      await cacheGameRecords(db, games, fetchedAt);
    } catch (upstreamError) {
      // Fall back to stale rows; only fail if we have nothing at all to show.
      if (stale.size === 0 && fresh.size === 0) throw upstreamError;
      console.warn('[igdb-proxy] lookup serving stale', upstreamError instanceof Error ? upstreamError.message : upstreamError);
      for (const [id, game] of stale) fetched.set(id, game);
    }
  }

  const allowed = new Set((await withoutExcluded([...fresh.values(), ...fetched.values()])).map((g) => g.id));
  const results: IgdbGameResult[] = [];
  const missing: number[] = [];
  for (const id of ids) {
    const game = allowed.has(id) ? (fresh.get(id) ?? fetched.get(id)) : undefined;
    if (game) results.push(game);
    else missing.push(id);
  }

  const data: IgdbLookupResponse = { entity_type: 'games', results, missing, cachedCount: fresh.size };
  return respond(200, { success: true, data }, { 'X-Cache': toFetch.length === 0 ? 'HIT' : fresh.size > 0 ? 'PARTIAL' : 'MISS' });
}

/** Full game page: cached 7 days as one record (IGDB detail + RAWG requirements). */
async function handleDetail(id: number): Promise<Response> {
  const db = cacheClient();
  const cacheKey = `game-detail:${CACHE_VERSION}:igdb+rawg:${id}`;
  const cached = await readCache(db, cacheKey);
  const cachedGame = cached?.payload.results[0] as IgdbGameDetail | undefined;

  if (cachedGame && (await getOverrides()).get(id) === 'exclude') {
    throw new HttpError(404, `Game ${id} is not in the GamerCred catalogue`);
  }
  const rulesVersion = await getRulesVersion();
  const state = cached
    ? cacheFreshness({ ageMs: cached.ageMs, ttlMs: GAME_RECORD_TTL_MS, refreshAfterMs: null, rulesVersion: cached.payload.rulesVersion, currentRulesVersion: rulesVersion })
    : 'expired';
  if (cached && cachedGame && state !== 'expired') {
    const data: IgdbDetailResponse = { game: cachedGame, cached: true, fetchedAt: cached.payload.fetchedAt };
    return respond(200, { success: true, data }, { 'X-Cache': 'HIT' });
  }
  // Refetching only because the IGDB rules changed? RAWG's PC requirements didn't — reuse them (saves RAWG quota).
  const reuseRequirements =
    cached && cachedGame && cached.ageMs < GAME_RECORD_TTL_MS ? { requirements: cachedGame.systemRequirements } : undefined;

  try {
    const payload = await fetchAndCacheOnce(db, cacheKey, async () => {
      const game = await fetchGameDetail(id, reuseRequirements);
      if (!game) throw new HttpError(404, `Game ${id} is not in the GamerCred catalogue`);
      // The detail record also refreshes the lightweight per-game record used by lookups.
      await cacheGameRecords(db, [game], new Date().toISOString());
      // Series (IGDB franchises) only come with the full page; the Stats page groups liked games by them (000029).
      const { error: seriesError } = await db.from('games').update({ series: game.franchises }).eq('igdb_id', game.id);
      if (seriesError) console.error('[igdb-proxy] series write failed', seriesError.message);
      return [game];
    }, { stampRules: true });
    const data: IgdbDetailResponse = { game: payload.results[0] as IgdbGameDetail, cached: false, fetchedAt: payload.fetchedAt };
    return respond(200, { success: true, data }, { 'X-Cache': cached ? 'REFRESH' : 'MISS' });
  } catch (error) {
    if (cached && cachedGame && cached.ageMs < STALE_MAX_MS && !(error instanceof HttpError && error.status === 404)) {
      const data: IgdbDetailResponse = { game: cachedGame, cached: true, fetchedAt: cached.payload.fetchedAt };
      return respond(200, { success: true, data }, { 'X-Cache': 'STALE' });
    }
    throw error;
  }
}

/** Studio page: cached 7 days as one record; stale copy served if IGDB is down. */
async function handleCompany(id: number): Promise<Response> {
  const db = cacheClient();
  const cacheKey = `company:${CACHE_VERSION}:igdb:${id}`;
  const cached = await readCache(db, cacheKey);
  const cachedCompany = cached?.payload.results[0] as IgdbCompanyDetail | undefined;
  const reply = async (company: IgdbCompanyDetail, fromCache: boolean, fetchedAt: string, xCache: string) => {
    const data: IgdbCompanyDetailResponse = {
      company: { ...company, games: await withoutExcluded(company.games) },
      cached: fromCache,
      fetchedAt,
    };
    return respond(200, { success: true, data }, { 'X-Cache': xCache });
  };

  const state = cached
    ? cacheFreshness({
        ageMs: cached.ageMs,
        ttlMs: GAME_RECORD_TTL_MS,
        refreshAfterMs: null,
        rulesVersion: cached.payload.rulesVersion,
        currentRulesVersion: await getRulesVersion(),
      })
    : 'expired';
  if (cached && cachedCompany && state !== 'expired') return reply(cachedCompany, true, cached.payload.fetchedAt, 'HIT');

  try {
    const payload = await fetchAndCacheOnce(db, cacheKey, async () => {
      const company = await fetchCompanyDetail(id);
      if (!company) throw new HttpError(404, `Studio ${id} was not found`);
      // Each game doubles as a per-game record, so opening one from the studio page is instant.
      await cacheGameRecords(db, company.games.map(({ roles: _roles, ...game }) => game), new Date().toISOString());
      return [company];
    }, { stampRules: true });
    return reply(payload.results[0] as IgdbCompanyDetail, false, payload.fetchedAt, cached ? 'REFRESH' : 'MISS');
  } catch (error) {
    if (cached && cachedCompany && cached.ageMs < STALE_MAX_MS && !(error instanceof HttpError && error.status === 404)) {
      return reply(cachedCompany, true, cached.payload.fetchedAt, 'STALE');
    }
    throw error;
  }
}

/** Per signed-in user (migration 000026). Search is debounced; a studio page or a 500-game smart list is ~10 calls. */
const RATE_LIMIT_PER_MINUTE = 120;
/** Guests (anonymous sign-in, migration 000027) browse with a tighter limit. */
const GUEST_RATE_LIMIT_PER_MINUTE = 30;

/**
 * Only signed-in players may use the proxy (the public anon key alone is not enough),
 * and each is rate limited, so nobody can drain the IGDB/RAWG allowance or flood the cache.
 */
async function requireCaller(req: Request): Promise<void> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Sign in to search the game database.');
  const db = cacheClient();
  const { data, error } = await db.auth.getClaims(token);
  const userId = data?.claims.sub;
  if (error || !userId || data.claims.role !== 'authenticated') throw new HttpError(401, 'Sign in to search the game database.');

  const guest = data.claims.is_anonymous === true;
  const { data: allowed, error: limitError } = await db.rpc('take_rate_limit', {
    p_user: userId,
    p_bucket: guest ? 'igdb-guest' : 'igdb',
    p_limit: guest ? GUEST_RATE_LIMIT_PER_MINUTE : RATE_LIMIT_PER_MINUTE,
    p_window_seconds: 60,
  });
  // A counter hiccup shouldn't take search down for everyone: log it and let the call through.
  if (limitError) console.error('[igdb-proxy] rate limit check failed', limitError.message);
  else if (allowed === false) throw new HttpError(429, 'Too many searches at once. Wait a minute and try again.');
}

async function handle(req: Request): Promise<Response> {
  await requireCaller(req);
  const parsed = await parseRequest(req);
  if (parsed.action === 'lookup') return handleLookup(parsed.ids);
  if (parsed.action === 'detail') return handleDetail(parsed.id);
  if (parsed.action === 'company') return handleCompany(parsed.id);
  const { entityType, query, limit } = parsed;

  const db = cacheClient();
  const cacheKey = `search:${CACHE_VERSION}:${SEARCH_PROVIDER[entityType]}:${entityType}:${limit}:${query}`;
  const cached = await readCache(db, cacheKey);

  const excludeIds = entityType === 'games' ? await getOverrides() : new Map<number, OverrideAction>();
  const build = (payload: CachedPayload, fromCache: boolean): IgdbSearchResponse => ({
    entity_type: entityType,
    query,
    results: (payload.results as { id: number }[]).filter(
      (r) => excludeIds.get(r.id) !== 'exclude',
    ) as IgdbSearchResponse['results'],
    cached: fromCache,
    fetchedAt: payload.fetchedAt,
  });

  const stampRules = SEARCH_PROVIDER[entityType] === 'igdb';
  const refresh = () =>
    fetchAndCacheOnce(
      db,
      cacheKey,
      async () => {
        const results = await fetchUpstream(entityType, query, limit);
        // Search hits double as per-game records, so later lookups (Now Playing, reviews) are free.
        if (entityType === 'games') await cacheGameRecords(db, results as IgdbGameResult[], new Date().toISOString());
        return results;
      },
      { stampRules },
    );

  const state = cached
    ? cacheFreshness({
        ageMs: cached.ageMs,
        ttlMs: CACHE_TTL_MS[entityType],
        refreshAfterMs: SEARCH_REFRESH_AFTER_MS[entityType],
        rulesVersion: cached.payload.rulesVersion,
        currentRulesVersion: stampRules ? await getRulesVersion() : undefined,
      })
    : 'expired';

  if (cached && state === 'fresh') {
    return respond(200, { success: true, data: build(cached.payload, true) }, { 'X-Cache': 'HIT' });
  }
  if (cached && state === 'revalidate') {
    // Stale-while-revalidate: answer instantly, refresh once in the background.
    runInBackground(refresh(), `refresh of ${cacheKey}`);
    return respond(200, { success: true, data: build(cached.payload, true) }, { 'X-Cache': 'REVALIDATING' });
  }

  try {
    const payload = await refresh();
    return respond(200, { success: true, data: build(payload, false) }, { 'X-Cache': cached ? 'REFRESH' : 'MISS' });
  } catch (error) {
    // Upstream trouble: fall back to stale cache rather than failing the search.
    if (cached && cached.ageMs < STALE_MAX_MS) {
      console.warn('[igdb-proxy] serving stale cache', error instanceof Error ? error.message : error);
      return respond(200, { success: true, data: build(cached.payload, true) }, { 'X-Cache': 'STALE' });
    }
    throw error;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    return await handle(req);
  } catch (error) {
    if (error instanceof HttpError) return respond(error.status, { success: false, error: error.message });
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return respond(504, { success: false, error: 'The game database took too long to respond. Try again.' });
    }
    console.error('[igdb-proxy] unexpected error', error);
    return respond(500, { success: false, error: 'Unexpected server error' });
  }
});
