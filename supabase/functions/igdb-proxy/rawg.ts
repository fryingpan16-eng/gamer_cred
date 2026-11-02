/**
 * RAWG creators search (directors, writers, composers, …).
 *
 * RAWG's published docs only list `page`/`page_size` for /creators; we also send
 * `search`, and — in case it is ignored or fuzzy — keep only creators whose name
 * actually contains every query token. Worst case is an empty list, never noise.
 */
import type { CreatorResult } from '../_shared/igdb-contract.ts';

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
