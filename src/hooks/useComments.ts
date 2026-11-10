import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';

import {
  editReviewComment,
  fetchReviewComments,
  postReviewComment,
  setCommentLike,
  type ReviewComment,
} from '@/services/comments';
import { queryKeys } from '@/utils/queryKeys';
import { commentSchema } from '@/utils/reviewSchemas';

import { useAuthStore, useMemberId } from './useAuth';
import { useProfile } from './useProfile';
import { showToast } from './useToastStore';

type CommentPages = InfiniteData<{ comments: ReviewComment[]; nextPage: number | null }, number>;

function useCommentsKey(reviewId: string) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  return queryKeys.reviews.comments(reviewId, viewerId ?? 'none');
}

/** One review's comments, oldest first, paged ("Load more"). Guests can read. */
export function useReviewComments(reviewId: string | null) {
  const key = useCommentsKey(reviewId ?? '');
  const hasSession = useAuthStore((s) => s.user !== null);
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchReviewComments(reviewId!, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
    enabled: reviewId !== null && hasSession,
    staleTime: 30_000,
  });
}

/** Refresh one review's thread and the 💬 counts that include it. */
function useRefreshComments(reviewId: string) {
  const queryClient = useQueryClient();
  const key = useCommentsKey(reviewId);
  return () => {
    void queryClient.invalidateQueries({ queryKey: key });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reviews.likesAll(),
      predicate: (q) => {
        const ids = q.queryKey[q.queryKey.length - 1];
        return Array.isArray(ids) && ids.includes(reviewId);
      },
    });
  };
}

/** Post a comment: it shows at once (greyed) at the end of the thread, and is taken back if it fails. */
export function usePostComment(reviewId: string) {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  const key = useCommentsKey(reviewId);
  const me = useProfile(viewerId);
  const refresh = useRefreshComments(reviewId);
  return useMutation({
    mutationFn: (content: string) => {
      if (!viewerId) throw new Error('Create a free account to comment.');
      return postReviewComment(viewerId, reviewId, content);
    },
    onMutate: async (content) => {
      const trimmed = content.trim();
      // Only when the whole thread is loaded (otherwise it would land mid-list), and it would pass the checks.
      const current = queryClient.getQueryData<CommentPages>(key);
      if (!viewerId || !current || current.pages.at(-1)?.nextPage !== null || !commentSchema.safeParse(content).success) {
        return { previous: undefined };
      }
      await queryClient.cancelQueries({ queryKey: key });
      const pending: ReviewComment = {
        id: `pending-${Date.now()}`,
        reviewId,
        userId: viewerId,
        author: { id: viewerId, username: me.data?.username ?? '', avatar_url: me.data?.avatar_url ?? null },
        content: trimmed,
        createdAt: new Date().toISOString(),
        editedAt: null,
        liked: false,
        likeCount: null,
        pending: true,
      };
      queryClient.setQueryData<CommentPages>(key, {
        ...current,
        pages: current.pages.map((p, i) => (i === current.pages.length - 1 ? { ...p, comments: [...p.comments, pending] } : p)),
      });
      return { previous: current };
    },
    onError: (_error, _content, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: refresh,
  });
}

export function useEditComment(reviewId: string) {
  const refresh = useRefreshComments(reviewId);
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) => editReviewComment(commentId, content),
    onSuccess: refresh,
  });
}

/** ♥ / un-♥ a comment: instant, rolled back with a message if it fails. */
export function useToggleCommentLike(reviewId: string) {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  const key = useCommentsKey(reviewId);
  return useMutation({
    mutationFn: ({ commentId, liked }: { commentId: string; liked: boolean }) => {
      if (!viewerId) throw new Error('Create a free account to like comments.');
      return setCommentLike(viewerId, commentId, liked);
    },
    onMutate: async ({ commentId, liked }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<CommentPages>(key);
      queryClient.setQueryData<CommentPages>(key, (data) =>
        data
          ? {
              ...data,
              pages: data.pages.map((p) => ({ ...p, comments: p.comments.map((c) => (c.id === commentId ? { ...c, liked } : c)) })),
            }
          : data,
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      showToast(error.message, 'error');
    },
  });
}
