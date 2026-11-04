import { useInfiniteQuery, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  browseGameReviews,
  fetchReviewLikeInfo,
  setReviewLike,
  type ReviewLikeInfo,
  type ReviewScope,
  type ReviewSort,
} from '@/services/reviewBrowser';
import { queryKeys } from '@/utils/queryKeys';

import { useMemberId } from './useAuth';
import { showToast } from './useToastStore';

/** One game's reviews for the browser: paged as you scroll. */
export function useReviewBrowser(gameId: number | null, scope: ReviewScope, sort: ReviewSort, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews.browse(gameId ?? 0, scope, sort),
    queryFn: ({ pageParam }) => browseGameReviews(gameId!, scope, sort, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
    enabled: enabled && gameId !== null,
    staleTime: 60_000,
  });
}

/** The first few reviews (the game page's preview). */
export function useReviewPreview(gameId: number, sort: ReviewSort, count: number) {
  return useQuery({
    queryKey: queryKeys.reviews.preview(gameId, sort, count),
    queryFn: () => browseGameReviews(gameId, 'community', sort, 0, count),
    staleTime: 60_000,
  });
}

/** Your ♥ on a batch of reviews (members only; guests get an empty map). */
export function useReviewLikes(reviewIds: readonly string[]) {
  const viewerId = useMemberId();
  const ids = [...new Set(reviewIds)];
  return useQuery({
    queryKey: queryKeys.reviews.likes(viewerId ?? 'guest', ids),
    queryFn: () => fetchReviewLikeInfo(ids),
    enabled: viewerId !== null && ids.length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });
}

/**
 * Your ♥ for a paged list: one query per page (each well under the 200-id limit),
 * so earlier pages aren't refetched when a new one loads. Returns one merged map.
 */
export function useReviewLikesByPage(pages: readonly (readonly string[])[]) {
  const viewerId = useMemberId();
  const results = useQueries({
    queries: pages.map((ids) => ({
      queryKey: queryKeys.reviews.likes(viewerId ?? 'guest', ids),
      queryFn: () => fetchReviewLikeInfo(ids),
      enabled: viewerId !== null && ids.length > 0,
      staleTime: 60_000,
    })),
  });
  const merged = new Map<string, ReviewLikeInfo>();
  for (const r of results) for (const [id, info] of r.data ?? []) merged.set(id, info);
  return merged;
}

/** ♥ / un-♥ a review: instant everywhere it's shown, rolled back if it fails. */
export function useToggleReviewLike() {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  return useMutation({
    mutationFn: ({ reviewId, liked }: { reviewId: string; liked: boolean }) => {
      if (!viewerId) throw new Error('Create a free account to like reviews.');
      return setReviewLike(viewerId, reviewId, liked);
    },
    onMutate: async ({ reviewId, liked }) => {
      const prefix = queryKeys.reviews.likesAll();
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshot = queryClient.getQueriesData<Map<string, ReviewLikeInfo>>({ queryKey: prefix });
      queryClient.setQueriesData<Map<string, ReviewLikeInfo>>({ queryKey: prefix }, (map) => {
        if (!map?.has(reviewId)) return map;
        const next = new Map(map);
        next.set(reviewId, { ...map.get(reviewId)!, liked });
        return next;
      });
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      for (const [key, data] of context?.snapshot ?? []) queryClient.setQueryData(key, data);
      showToast(error.message, 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.likesAll() });
      // "Popular" order may change.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.browseAll() });
    },
  });
}
