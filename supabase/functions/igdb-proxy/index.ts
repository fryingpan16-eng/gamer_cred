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
 * Response: ApiEnvelope<IgdbSearchResponse | IgdbLookupResponse>  ({ success, data?, error? })
 *
 * Secrets (supabase secrets set …): IGDB_CLIENT_ID, IGDB_CLIENT_SECRET, RAWG_API_KEY
 * Auto-injected by Supabase:        SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * The service-role client is used ONLY for igdb_cache reads/writes; RLS keeps
 * that table read-only for app users. Twitch tokens are never persisted (the
 * cache table is publicly readable) — they live in isolate memory only.
 */
import { createClient } from '@supabase/supabase-js';

import {
  IGDB_ENTITY_TYPES,
  IGDB_LOOKUP_MAX_IDS,
  IGDB_SEARCH_LIMITS,
  normalizeSearchQuery,
  SEARCH_PROVIDER,
  type ApiEnvelope,
  type IgdbCompanyResult,
  type IgdbEntityType,
  type IgdbGameResult,
  type IgdbLookupResponse,
  type IgdbSearchResponse,
} from '../_shared/igdb-contract.ts';

import { RawgError, searchRawgCreators } from './rawg.ts';

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
const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_VERSION = 'v1'; // bump when result shapes change

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
type ParsedRequest = ParsedSearch | ParsedLookup;

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
  if (action !== 'search') throw new HttpError(400, "action must be 'search' or 'lookup'");

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

async function igdbRequest<T>(endpoint: string, body: string, retried = false): Promise<T> {
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
    return igdbRequest<T>(endpoint, body, true);
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
  platforms?: { abbreviation?: string; name?: string }[];
  genres?: { name?: string }[];
  involved_companies?: { developer?: boolean; company?: { name?: string } }[];
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

const GAME_FIELDS = [
  'fields name,slug,cover.image_id,first_release_date,total_rating,',
  'platforms.abbreviation,platforms.name,genres.name,',
  'involved_companies.developer,involved_companies.company.name;',
].join(' ');

async function searchGames(query: string, limit: number): Promise<IgdbGameResult[]> {
  const q = apicalypseLiteral(query);
  const raw = await igdbRequest<RawGame[]>(
    'games',
    [
      `search "${q}";`,
      GAME_FIELDS,
      'where version_parent = null;', // hide editions/bundles of the same game
      `limit ${limit};`,
    ].join(' '),
  );
  return mapGames(raw);
}

async function fetchGamesByIds(ids: number[]): Promise<IgdbGameResult[]> {
  const raw = await igdbRequest<RawGame[]>('games', `${GAME_FIELDS} where id = (${ids.join(',')}); limit ${ids.length};`);
  return mapGames(raw);
}

function mapGames(raw: RawGame[]): IgdbGameResult[] {
  return raw
    .filter((g) => typeof g.name === 'string')
    .map((g) => ({
      kind: 'game' as const,
      id: g.id,
      name: g.name!,
      slug: g.slug ?? null,
      coverImageId: g.cover?.image_id ?? null,
      releaseYear: yearFromUnix(g.first_release_date),
      rating: typeof g.total_rating === 'number' ? Math.round(g.total_rating) : null,
      platforms: compact((g.platforms ?? []).map((p) => p.abbreviation ?? p.name)),
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

  const rank = (name: string) => {
    const n = name.toLowerCase();
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    if (n.split(/\s+/).some((word) => word.startsWith(q))) return 2;
    return 3;
  };

  return raw
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
    }))
    .sort(
      (a, b) =>
        rank(a.name) - rank(b.name) ||
        b.developedCount + b.publishedCount - (a.developedCount + a.publishedCount),
    )
    .slice(0, limit);
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

type CachedPayload = { results: unknown[]; fetchedAt: string };

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
): Promise<CachedPayload> {
  const existing = inflightFetches.get(cacheKey);
  if (existing) return existing;

  const task = (async () => {
    const payload: CachedPayload = { results: await fetcher(), fetchedAt: new Date().toISOString() };
    await writeCache(db, cacheKey, payload); // empty result sets are cached too
    return payload;
  })().finally(() => inflightFetches.delete(cacheKey));

  inflightFetches.set(cacheKey, task);
  return task;
}

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

function gameCacheKey(id: number): string {
  return `game:${CACHE_VERSION}:igdb:${id}`;
}

async function cacheGameRecords(
  db: ReturnType<typeof cacheClient>,
  games: IgdbGameResult[],
  fetchedAt: string,
): Promise<void> {
  if (games.length === 0) return;
  const { error } = await db.from('igdb_cache').upsert(
    games.map((game) => ({ cache_key: gameCacheKey(game.id), data: { results: [game], fetchedAt }, updated_at: fetchedAt })),
    { onConflict: 'cache_key' },
  );
  if (error) console.error('[igdb-proxy] game record cache write failed', error.message);
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

  const fresh = new Map<number, IgdbGameResult>();
  const stale = new Map<number, IgdbGameResult>();
  for (const row of rows ?? []) {
    const game = (row.data as CachedPayload | null)?.results?.[0] as IgdbGameResult | undefined;
    if (!game) continue;
    const age = Date.now() - new Date(row.updated_at as string).getTime();
    (age < GAME_RECORD_TTL_MS ? fresh : stale).set(game.id, game);
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

  const results: IgdbGameResult[] = [];
  const missing: number[] = [];
  for (const id of ids) {
    const game = fresh.get(id) ?? fetched.get(id);
    if (game) results.push(game);
    else missing.push(id);
  }

  const data: IgdbLookupResponse = { entity_type: 'games', results, missing, cachedCount: fresh.size };
  return respond(200, { success: true, data }, { 'X-Cache': toFetch.length === 0 ? 'HIT' : fresh.size > 0 ? 'PARTIAL' : 'MISS' });
}

async function handle(req: Request): Promise<Response> {
  const parsed = await parseRequest(req);
  if (parsed.action === 'lookup') return handleLookup(parsed.ids);
  const { entityType, query, limit } = parsed;

  const db = cacheClient();
  const cacheKey = `search:${CACHE_VERSION}:${SEARCH_PROVIDER[entityType]}:${entityType}:${limit}:${query}`;
  const cached = await readCache(db, cacheKey);

  const build = (payload: CachedPayload, fromCache: boolean): IgdbSearchResponse => ({
    entity_type: entityType,
    query,
    results: payload.results as IgdbSearchResponse['results'],
    cached: fromCache,
    fetchedAt: payload.fetchedAt,
  });

  if (cached && cached.ageMs < CACHE_TTL_MS[entityType]) {
    return respond(200, { success: true, data: build(cached.payload, true) }, { 'X-Cache': 'HIT' });
  }

  try {
    const payload = await fetchAndCacheOnce(db, cacheKey, async () => {
      const results = await fetchUpstream(entityType, query, limit);
      // Search hits double as per-game records, so later lookups (Now Playing, reviews) are free.
      if (entityType === 'games') await cacheGameRecords(db, results as IgdbGameResult[], new Date().toISOString());
      return results;
    });
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
