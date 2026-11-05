import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { addReplay, deleteReplay, fetchMostReplayed, fetchMyReplays } from '@/services/replays';
import { queryKeys } from '@/utils/queryKeys';

import { useMemberId } from './useAuth';
import { refreshFeeds } from './useFeed';
import { useMyReviewsForGame } from './useReviews';

/** Your game-page replays of a game. */
export function useMyReplays(gameId: number) {
  const viewerId = useMemberId();
  return useQuery({
    queryKey: queryKeys.replays.mineForGame(viewerId ?? 'none', gameId),
    queryFn: () => fetchMyReplays(viewerId!, gameId),
    enabled: viewerId !== null,
  });
}

/**
 * Your plays of a game: game-page replays + published replay reviews, plus the
 * first play (any rating, review or replay counts as having played it).
 */
export function useMyPlayCount(gameId: number, hasRating: boolean) {
  const replays = useMyReplays(gameId);
  const reviews = useMyReviewsForGame(gameId);
  const replayReviews = reviews.data?.published.filter((r) => r.is_replay).length ?? 0;
  const replayCount = (replays.data?.length ?? 0) + replayReviews;
  const played = hasRating || replayCount > 0 || (reviews.data?.all.length ?? 0) > 0;
  return {
    isPending: replays.isPending || reviews.isPending,
    replays: replayCount,
    plays: played ? replayCount + 1 : 0,
  };
}

function useInvalidateReplays() {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.replays.all() });
    void queryClient.invalidateQueries({ queryKey: queryKeys.ratings.ofUserAll() }); // ×N on the ratings list
    void queryClient.invalidateQueries({ queryKey: queryKeys.games.friendReviewsAll() });
    if (viewerId) void queryClient.invalidateQueries({ queryKey: queryKeys.stats.byUser(viewerId) });
    if (viewerId) void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.byUser(viewerId) }); // a replay leaves the backlog
    refreshFeeds(queryClient);
  };
}

export function useAddReplay() {
  const viewerId = useMemberId();
  const invalidate = useInvalidateReplays();
  return useMutation({
    mutationFn: ({ gameId, finishedOn, platformId }: { gameId: number; finishedOn: string; platformId: number | null }) => {
      if (!viewerId) throw new Error('Create a free account to track replays.');
      return addReplay(viewerId, gameId, finishedOn, platformId);
    },
    onSettled: invalidate,
  });
}

export function useDeleteReplay() {
  const viewerId = useMemberId();
  const invalidate = useInvalidateReplays();
  return useMutation({
    mutationFn: (replayId: string) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return deleteReplay(viewerId, replayId);
    },
    onSettled: invalidate,
  });
}

/** A player's most replayed game, for the profile card. */
export function useMostReplayed(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.replays.mostReplayed(userId ?? 'none'),
    queryFn: () => fetchMostReplayed(userId!),
    enabled: userId !== null,
    staleTime: 60_000,
  });
}
