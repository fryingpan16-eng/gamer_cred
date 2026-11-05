import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { lookupGames } from '@/services/igdb';
import type { IgdbGameResult } from '@/types/igdb';
import { queryKeys } from '@/utils/queryKeys';

/** Game records are near-static; the proxy also caches them for 7 days. */
const GAME_STALE_MS = 6 * 60 * 60_000;

/**
 * Lookups requested in the same tick (every section of a profile, say) go to
 * the proxy as ONE batch (chunked at 50 by lookupGames) instead of one call
 * per section. Each caller gets the whole batch's map and reads its own ids.
 */
type LookupBatch = { ids: Set<number>; waiters: { resolve: (m: Map<number, IgdbGameResult>) => void; reject: (e: unknown) => void }[] };
let pendingBatch: LookupBatch | null = null;

function flushLookupBatch() {
  const batch = pendingBatch;
  pendingBatch = null;
  if (!batch) return;
  lookupGames([...batch.ids]).then(
    ({ results, moved }) => {
      const byId = new Map(results.map((g) => [g.id, g] as const));
      // Another version's old id (Director's Cut…) shows the game it belongs to; its saved data moves there server-side.
      for (const [from, to] of Object.entries(moved ?? {})) {
        const game = byId.get(to);
        if (game) byId.set(Number(from), game);
      }
      for (const w of batch.waiters) w.resolve(byId);
    },
    (error: unknown) => {
      for (const w of batch.waiters) w.reject(error);
    },
  );
}

function batchedLookup(ids: readonly number[]): Promise<Map<number, IgdbGameResult>> {
  return new Promise((resolve, reject) => {
    if (!pendingBatch) {
      pendingBatch = { ids: new Set(), waiters: [] };
      setTimeout(flushLookupBatch, 0);
    }
    for (const id of ids) pendingBatch.ids.add(id);
    pendingBatch.waiters.push({ resolve, reject });
  });
}

/** Seed per-game cache entries (e.g. from a search result the user just picked). */
export function primeGameCache(queryClient: QueryClient, games: readonly IgdbGameResult[]): void {
  for (const game of games) queryClient.setQueryData(queryKeys.games.detail(game.id), game);
}

/**
 * Resolves IGDB ids to game records as a `Map<id, game>`.
 * Ids already in the per-game cache are served locally; only unknown ids hit the proxy.
 */
export function useGameLookup(gameIds: readonly number[]) {
  const queryClient = useQueryClient();
  const ids = [...new Set(gameIds)].filter((id) => Number.isSafeInteger(id) && id > 0);

  return useQuery({
    queryKey: queryKeys.games.lookup(ids),
    enabled: ids.length > 0,
    staleTime: GAME_STALE_MS,
    // Keep covers on screen while a changed id set (slot swap) resolves.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const byId = new Map<number, IgdbGameResult>();
      const unknown: number[] = [];
      for (const id of ids) {
        const cached = queryClient.getQueryData<IgdbGameResult>(queryKeys.games.detail(id));
        if (cached) byId.set(id, cached);
        else unknown.push(id);
      }
      if (unknown.length > 0) {
        // Shared with other lookups this tick, so it isn't cancelled per caller (an aborted caller just ignores it).
        const fetched = await batchedLookup(unknown);
        const results = unknown.flatMap((id) => {
          const game = fetched.get(id);
          return game ? [[id, game] as const] : [];
        });
        primeGameCache(
          queryClient,
          results.map(([, game]) => game),
        );
        // Keyed by the id asked for: a moved version's old id maps to its game.
        for (const [id, game] of results) byId.set(id, game);
      }
      return byId;
    },
  });
}
