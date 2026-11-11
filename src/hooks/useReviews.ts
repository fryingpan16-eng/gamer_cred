import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearSlot } from '@/services/nowPlaying';
import {
  deleteReview,
  fetchMyReviews,
  fetchMyReviewsForGame,
  fetchPlaythroughs,
  fetchReviewById,
  saveReview,
  type SaveReviewInput,
} from '@/services/reviews';
import type { NowPlaying, NowPlayingSlot, Review, ReviewStatus } from '@/types/database.types';
import { queryKeys } from '@/utils/queryKeys';
import { summarizeMyReviews } from '@/utils/studioTarget';

import { useAuthStore } from './useAuth';
import { refreshFeeds } from './useFeed';
import { showToast } from './useToastStore';

export type { MyGameReviews } from '@/utils/studioTarget';

function useViewerId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

/** A single review (with author) for the review page. */
export function useReview(reviewId: string | null) {
  return useQuery({
    queryKey: queryKeys.reviews.detail(reviewId ?? 'none'),
    queryFn: () => fetchReviewById(reviewId!),
    enabled: reviewId !== null,
  });
}

export function useMyReviews(status?: ReviewStatus) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.reviews.mine(viewerId ?? 'anonymous', status),
    queryFn: () => fetchMyReviews(viewerId!, status),
    enabled: viewerId !== null,
  });
}

/** The viewer's reviews of a game (drafts included): what the Studio opens and the game page's button says. */
export function useMyReviewsForGame(gameId: number | null) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.reviews.mineForGame(viewerId ?? 'anonymous', gameId ?? 0),
    queryFn: async () => summarizeMyReviews(await fetchMyReviewsForGame(viewerId!, gameId!)),
    enabled: viewerId !== null && gameId !== null,
  });
}

/** "Review 2 of 3": the author's published reviews of this review's game. */
export function usePlaythroughs(reviewId: string | null) {
  return useQuery({
    queryKey: queryKeys.reviews.playthroughs(reviewId ?? 'none'),
    queryFn: () => fetchPlaythroughs(reviewId!),
    enabled: reviewId !== null,
  });
}

export type SaveReviewVariables = SaveReviewInput & {
  /** When publishing from a Now Playing slot, free the slot afterwards. */
  clearSlot?: NowPlayingSlot;
};

/**
 * Save a draft ("quick backlog notes") or publish. Use the `usePublishReview` /
 * `useSaveReviewDraft` wrappers for intent-specific call sites.
 */
export function useSaveReview() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();

  return useMutation({
    mutationFn: async (vars: SaveReviewVariables): Promise<Review> => {
      if (!viewerId) throw new Error('You must be signed in.');
      const review = await saveReview(viewerId, vars);
      if (vars.clearSlot !== undefined && vars.status === 'published') {
        // The review is already published: a failed slot clean-up must not report the publish as failed.
        try {
          await clearSlot(viewerId, vars.clearSlot);
        } catch {
          showToast(`Review published, but Now Playing slot ${vars.clearSlot} couldn't be freed. Remove it from the slot.`, 'info');
        }
      }
      return review;
    },
    onSuccess: (_review, vars) => {
      if (!viewerId) return;
      if (vars.clearSlot !== undefined && vars.status === 'published') {
        queryClient.setQueryData<NowPlaying[]>(queryKeys.nowPlaying.byUser(viewerId), (rows) =>
          rows?.filter((r) => r.slot_index !== vars.clearSlot),
        );
      }
    },
    onSettled: (_review, _error, vars) => {
      if (!viewerId) return;
      const { gameId } = vars;
      // Other review lists are marked stale (refresh when next shown); this game's and your own refetch now.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all(), refetchType: 'none' });
      // The review page stays mounted under the Studio: refresh the edited review so Back shows the new text.
      const reviewId = vars.reviewId ?? _review?.id;
      if (reviewId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.detail(reviewId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.playthroughs(reviewId) });
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.mineAll(viewerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byUser(viewerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.byGame(gameId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.browseGame(gameId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nowPlaying.byUser(viewerId) });
      // Drafts never appear in feeds; a publish reloads them from the top.
      if (vars.status === 'published') refreshFeeds(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewStats(gameId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats.byUser(viewerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.replays.all() }); // replay reviews count as replays (000040)
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.friendReviewsAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.byUser(viewerId) }); // rating a game takes it off the backlog (000035)
      // A review's score is also the user's quick rating (sync trigger, migration 000015).
      void queryClient.invalidateQueries({ queryKey: queryKeys.ratings.byUser(viewerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.ratings.ofUser(viewerId) });
    },
  });
}

export function usePublishReview() {
  const mutation = useSaveReview();
  return {
    ...mutation,
    publish: (values: Omit<SaveReviewVariables, 'status'>) => mutation.mutateAsync({ ...values, status: 'published' }),
  };
}

export function useSaveReviewDraft() {
  const mutation = useSaveReview();
  return {
    ...mutation,
    saveDraft: (values: Omit<SaveReviewVariables, 'status' | 'clearSlot'>) => mutation.mutateAsync({ ...values, status: 'draft' }),
  };
}

export function useDeleteReview() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (reviewId: string) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return deleteReview(viewerId, reviewId);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all() });
      refreshFeeds(queryClient);
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewStatsAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.friendReviewsAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.stats.all() });
      // Deleting your newest review puts your score back to the one before it (000040).
      void queryClient.invalidateQueries({ queryKey: queryKeys.ratings.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.replays.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.backlog.all() }); // rating a game takes it off the backlog (000035)
    },
  });
}
