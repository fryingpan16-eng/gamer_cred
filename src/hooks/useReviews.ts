import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { clearSlot } from '@/services/nowPlaying';
import { deleteReview, fetchMyReviewForGame, fetchMyReviews, saveReview } from '@/services/reviews';
import type { NowPlaying, NowPlayingSlot, Review, ReviewStatus } from '@/types/database.types';
import type { ReviewFormValues } from '@/utils/reviewSchemas';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

function useViewerId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

export function useMyReviews(status?: ReviewStatus) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.reviews.mine(viewerId ?? 'anonymous', status),
    queryFn: () => fetchMyReviews(viewerId!, status),
    enabled: viewerId !== null,
  });
}

/** The viewer's existing review (draft or published) for a game, to prefill the studio form. */
export function useMyReviewForGame(gameId: number | null) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.reviews.mineForGame(viewerId ?? 'anonymous', gameId ?? 0),
    queryFn: () => fetchMyReviewForGame(viewerId!, gameId!),
    enabled: viewerId !== null && gameId !== null,
  });
}

export type SaveReviewVariables = ReviewFormValues & {
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
      if (vars.clearSlot !== undefined && vars.status === 'published') await clearSlot(viewerId, vars.clearSlot);
      return review;
    },
    onSuccess: (review, vars) => {
      if (!viewerId) return;
      queryClient.setQueryData(queryKeys.reviews.mineForGame(viewerId, review.game_id), review);
      if (vars.clearSlot !== undefined && vars.status === 'published') {
        queryClient.setQueryData<NowPlaying[]>(queryKeys.nowPlaying.byUser(viewerId), (rows) =>
          rows?.filter((r) => r.slot_index !== vars.clearSlot),
        );
      }
    },
    onSettled: () => {
      if (!viewerId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nowPlaying.byUser(viewerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewsAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewStatsAll() });
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
    saveDraft: (values: Omit<SaveReviewVariables, 'status' | 'clearSlot'>) =>
      mutation.mutateAsync({ ...values, status: 'draft' }),
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewsAll() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewStatsAll() });
    },
  });
}
