/**
 * Cache policy for igdb_cache. Pure and unit-tested; index.ts applies it.
 *
 * Every cached IGDB result is stamped with a **rules version**, a fingerprint of
 * the curation + ranking code. A deploy that changes any rule makes older entries
 * "expired" automatically, so a stale answer can never outlive the rules that
 * produced it.
 *
 * Searches use **stale-while-revalidate**: inside the refresh window a cached
 * result is fresh; after it (but before the hard TTL) the cached result is served
 * instantly while one background refresh updates it. At most one upstream call
 * per search term per window, and only for terms people actually search.
 */
import type { IgdbEntityType } from '../_shared/igdb-contract.ts';

const HOUR_MS = 60 * 60 * 1000;

/**
 * When a cached search starts refreshing in the background (null = never).
 * RAWG (creators) is deliberately excluded: its free tier has a monthly cap, and
 * people data changes rarely, so it keeps its long hard TTL instead.
 */
export const SEARCH_REFRESH_AFTER_MS: Record<IgdbEntityType, number | null> = {
  games: 6 * HOUR_MS,
  companies: 3 * 24 * HOUR_MS,
  creators: null,
};

export type Freshness = 'fresh' | 'revalidate' | 'expired';

/**
 * - `expired`    → fetch now (fall back to the cached copy only if upstream fails)
 * - `revalidate` → serve the cached copy now, refresh it in the background
 * - `fresh`      → serve the cached copy
 * `rulesVersion: undefined` means "not stamped" (e.g. RAWG data): never invalidated by rule changes.
 */
export function cacheFreshness(entry: {
  ageMs: number;
  ttlMs: number;
  refreshAfterMs: number | null;
  rulesVersion?: string | undefined;
  currentRulesVersion?: string | undefined;
}): Freshness {
  if (entry.currentRulesVersion !== undefined && entry.rulesVersion !== entry.currentRulesVersion) return 'expired';
  if (entry.ageMs >= entry.ttlMs) return 'expired';
  if (entry.refreshAfterMs !== null && entry.ageMs >= entry.refreshAfterMs) return 'revalidate';
  return 'fresh';
}

/**
 * Stable short fingerprint of everything that decides what IGDB results look
 * like: pass the curation/ranking modules and any extra strings (query fields,
 * mapping functions). Functions contribute their source text, constants their
 * JSON, so editing any rule changes the version.
 */
export async function computeRulesVersion(parts: readonly unknown[]): Promise<string> {
  const text = parts.map(describe).join('\n§\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function describe(value: unknown): string {
  if (typeof value === 'function') return value.toString();
  if (value instanceof Set) return JSON.stringify([...value].sort());
  if (value instanceof Map) return JSON.stringify([...value].sort());
  if (value !== null && typeof value === 'object') {
    // Module namespaces / plain objects: describe every member in key order.
    return Object.keys(value)
      .sort()
      .map((k) => `${k}=${describe((value as Record<string, unknown>)[k])}`)
      .join(';');
  }
  return JSON.stringify(value) ?? String(value);
}

/**
 * Run work after the response is sent. Supabase's Edge Runtime keeps the isolate
 * alive for `EdgeRuntime.waitUntil` promises; elsewhere (local `deno run`) the
 * promise simply runs to completion on its own.
 */
export function runInBackground(task: Promise<unknown>, label: string): void {
  const guarded = task.catch((error) =>
    console.warn(`[igdb-proxy] background ${label} failed`, error instanceof Error ? error.message : error),
  );
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  runtime?.waitUntil?.(guarded);
}
