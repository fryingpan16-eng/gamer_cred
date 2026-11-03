import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchFriendReviewsForGame, fetchGameDetail, fetchGameReviews, fetchGameReviewStats } from '@/services/games';
import { SearchServiceError } from '@/services/igdb';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';
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

/** Friends' published reviews of this game, shown before other community reviews. */
export function useFriendReviewsForGame(gameId: number | null) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: queryKeys.games.friendReviews(viewerId ?? 'anonymous', gameId ?? 0),
    enabled: gameId !== null && viewerId !== null,
    queryFn: () => fetchFriendReviewsForGame(gameId!),
  });
}

export function useGameReviewStats(gameId: number | null) {
  return useQuery({
    queryKey: queryKeys.games.reviewStats(gameId ?? 0),
    enabled: gameId !== null,
    queryFn: () => fetchGameReviewStats(gameId!),
  });
}
