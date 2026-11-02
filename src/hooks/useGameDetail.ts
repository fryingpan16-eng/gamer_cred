import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchGameDetail, fetchGameReviews, fetchGameReviewStats } from '@/services/games';
import { SearchServiceError } from '@/services/igdb';
import { queryKeys } from '@/utils/queryKeys';

import { primeGameCache } from './useGames';

/** The proxy caches 7 days; within a session, game pages are effectively static. */
const DETAIL_STALE_MS = 60 * 60_000;

export function useGameDetail(gameId: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.games.fullDetail(gameId ?? 0),
    enabled: gameId !== null,
    staleTime: DETAIL_STALE_MS,
    queryFn: async ({ signal }) => {
      const response = await fetchGameDetail(gameId!, signal);
      // The detail record is a superset of the light record used by covers/slots.
      primeGameCache(queryClient, [response.game]);
      return response;
    },
    retry: (count, error) => !(error instanceof SearchServiceError && !error.retryable) && count < 2,
  });
}

export function useGameReviews(gameId: number | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.games.reviews(gameId ?? 0),
    enabled: gameId !== null,
    queryFn: ({ pageParam }) => fetchGameReviews(gameId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
  });
}

export function useGameReviewStats(gameId: number | null) {
  return useQuery({
    queryKey: queryKeys.games.reviewStats(gameId ?? 0),
    enabled: gameId !== null,
    queryFn: () => fetchGameReviewStats(gameId!),
  });
}
