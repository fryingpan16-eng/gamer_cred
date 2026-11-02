import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { lookupGames } from '@/services/igdb';
import type { IgdbGameResult } from '@/types/igdb';
import { queryKeys } from '@/utils/queryKeys';

/** Game records are near-static; the proxy also caches them for 7 days. */
const GAME_STALE_MS = 6 * 60 * 60_000;

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
    queryFn: async ({ signal }) => {
      const byId = new Map<number, IgdbGameResult>();
      const unknown: number[] = [];
      for (const id of ids) {
        const cached = queryClient.getQueryData<IgdbGameResult>(queryKeys.games.detail(id));
        if (cached) byId.set(id, cached);
        else unknown.push(id);
      }
      if (unknown.length > 0) {
        const { results } = await lookupGames(unknown, signal);
        primeGameCache(queryClient, results);
        for (const game of results) byId.set(game.id, game);
      }
      return byId;
    },
  });
}
