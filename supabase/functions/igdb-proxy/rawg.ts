/**
 * RAWG creators search (directors, writers, composers, …).
 *
 * RAWG's published docs only list `page`/`page_size` for /creators; we also send
 * `search`, and — in case it is ignored or fuzzy — keep only creators whose name
 * actually contains every query token. Worst case is an empty list, never noise.
 */
import type { CreatorResult, SystemRequirementLine, SystemRequirements } from '../_shared/igdb-contract.ts';

export class RawgError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type RawRawgCreator = {
  id: number;
  name?: string;
  slug?: string;
  image?: string | null;
  games_count?: number;
  positions?: { name?: string; slug?: string }[];
  games?: { name?: string; added?: number }[];
};

type RawRawgPage = { count?: number; results?: RawRawgCreator[] };

const RAWG_BASE = 'https://api.rawg.io/api';
const IMAGE_SIZE = 200;

/** Fold case and diacritics so "Kojima" matches "kojima" and "Jose" matches "José". */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** RAWG serves resized images by inserting /resize/<w>/-/ after /media/. */
export function rawgResizedImage(url: string | null | undefined, width = IMAGE_SIZE): string | null {
  if (!url) return null;
  if (!url.startsWith('https://media.rawg.io/media/') || url.includes('/media/resize/')) return url;
  return url.replace('https://media.rawg.io/media/', `https://media.rawg.io/media/resize/${width}/-/`);
}

export function matchesAllTokens(name: string, query: string): boolean {
  const haystack = foldText(name);
  return foldText(query)
    .split(' ')
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function rank(name: string, query: string): number {
  const n = foldText(name);
  const q = foldText(query);
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.split(/\s+/).some((word) => word.startsWith(q))) return 2;
  return 3;
}

export function mapRawgCreators(raw: RawRawgCreator[], query: string, limit: number): CreatorResult[] {
  return raw
    .filter((c): c is RawRawgCreator & { name: string } => typeof c.name === 'string' && matchesAllTokens(c.name, query))
    .map((c) => ({
      kind: 'creator' as const,
      source: 'rawg' as const,
      id: c.id,
      name: c.name,
      slug: c.slug ?? null,
      imageUrl: rawgResizedImage(c.image),
      gamesCount: c.games_count ?? 0,
      positions: [...new Set((c.positions ?? []).map((p) => p.name).filter((n): n is string => !!n))],
      knownFor: (c.games ?? [])
        .filter((g): g is { name: string; added?: number } => typeof g.name === 'string')
        .sort((a, b) => (b.added ?? 0) - (a.added ?? 0))
        .slice(0, 3)
        .map((g) => g.name),
    }))
    .sort((a, b) => rank(a.name, query) - rank(b.name, query) || b.gamesCount - a.gamesCount)
    .slice(0, limit);
}

export async function searchRawgCreators(
  query: string,
  limit: number,
  apiKey: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<CreatorResult[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = new URL(`${RAWG_BASE}/creators`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('search', query);
  // Over-fetch so the local name filter still leaves `limit` good matches.
  url.searchParams.set('page_size', String(Math.min(Math.max(limit * 2, 20), 40)));

  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
  });

  if (res.status === 401 || res.status === 403) throw new RawgError(502, 'RAWG rejected the API key');
  if (res.status === 429) throw new RawgError(429, 'RAWG rate limit reached. Try again later.');
  if (!res.ok) throw new RawgError(502, `RAWG request failed (${res.status})`);

  const page = (await res.json()) as RawRawgPage;
  return mapRawgCreators(page.results ?? [], query, limit);
}

// -----------------------------------------------------------------------------
// PC system requirements (RAWG /games/{slug})
// -----------------------------------------------------------------------------

type RawRawgGame = {
  id: number;
  slug?: string;
  name?: string;
  platforms?: {
    platform?: { slug?: string };
    requirements?: { minimum?: string; recommended?: string } | null;
  }[];
};

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/**
 * RAWG requirement blobs are either plain text ("Minimum:\nOS: Windows 10\n…")
 * or HTML (<strong>OS:</strong> … <br>). Normalize both into label/value rows.
 */
export function parseRequirementText(raw: string | undefined | null): SystemRequirementLine[] {
  if (!raw) return [];
  const text = raw
    .replace(/<\s*(br|\/li|\/p|\/ul)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITIES[e.toLowerCase()] ?? e);

  return text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0 && !/^(minimum|recommended)\s*:?$/i.test(line))
    .map((line) => {
      // "Minimum: OS: Windows 10" → drop the section prefix first.
      const cleaned = line.replace(/^(minimum|recommended)\s*:\s*/i, '');
      const match = /^([A-Za-z][A-Za-z /&.-]{1,30}):\s*(.+)$/.exec(cleaned);
      return match ? { label: match[1]!.trim(), value: match[2]!.trim() } : { label: null, value: cleaned };
    })
    .filter((row) => row.value.length > 0)
    .slice(0, 20);
}

function pcRequirements(game: RawRawgGame): SystemRequirements | null {
  const pc = (game.platforms ?? []).find((p) => p.platform?.slug === 'pc');
  const minimum = parseRequirementText(pc?.requirements?.minimum);
  const recommended = parseRequirementText(pc?.requirements?.recommended);
  if (minimum.length === 0 && recommended.length === 0) return null;
  return { minimum, recommended, source: 'rawg', sourceUrl: `https://rawg.io/games/${game.slug ?? game.id}` };
}

/**
 * Best-effort PC requirements for a game. IGDB and RAWG slugs usually match, so
 * try the slug first; otherwise accept only an exact (folded) name match from
 * search. Returns null when RAWG has nothing — never throws for "not found".
 */
export async function fetchRawgPcRequirements(
  slug: string | null,
  name: string,
  apiKey: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SystemRequirements | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  const get = async <T>(path: string, params: Record<string, string> = {}): Promise<T | null> => {
    const url = new URL(`${RAWG_BASE}${path}`);
    url.searchParams.set('key', apiKey);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new RawgError(502, 'RAWG rejected the API key');
    if (res.status === 429) throw new RawgError(429, 'RAWG rate limit reached. Try again later.');
    if (!res.ok) throw new RawgError(502, `RAWG request failed (${res.status})`);
    return (await res.json()) as T;
  };

  if (slug) {
    const bySlug = await get<RawRawgGame>(`/games/${encodeURIComponent(slug)}`);
    if (bySlug && bySlug.name && foldText(bySlug.name) === foldText(name)) return pcRequirements(bySlug);
  }

  const search = await get<{ results?: RawRawgGame[] }>('/games', { search: name, search_precise: 'true', page_size: '5' });
  const exact = (search?.results ?? []).find((g) => g.name && foldText(g.name) === foldText(name));
  if (!exact) return null;
  const detail = await get<RawRawgGame>(`/games/${exact.id}`);
  return detail ? pcRequirements(detail) : null;
}
