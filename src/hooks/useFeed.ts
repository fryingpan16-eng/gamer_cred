import { useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { fetchFeedPage, fetchTrendingGames, fetchTrendingPosts, type FeedCursor, type FeedScope } from '@/services/feed';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

const isInfinite = (d: unknown): d is InfiniteData<unknown, unknown> =>
  typeof d === 'object' && d !== null && Array.isArray((d as InfiniteData<unknown>).pages);

/**
 * Keep only the first page of each cached feed. A refetch then reloads one page
 * instead of every page scrolled so far (one after another); older pages load
 * again as you scroll.
 */
export function trimFeedsToFirstPage(queryClient: QueryClient) {
  queryClient.setQueriesData<unknown>({ queryKey: queryKeys.feed.all() }, (data: unknown) =>
    isInfinite(data) && data.pages.length > 1 ? { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) } : data,
  );
}

/** New or removed published content: reload the feeds from the top (first page only). */
export function refreshFeeds(queryClient: QueryClient) {
  trimFeedsToFirstPage(queryClient);
  void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() });
}

/** Paginated activity stream. Friends scope is per viewer; community is shared. */
export function useActivityFeed(scope: FeedScope) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  return useInfiniteQuery({
    queryKey: scope === 'friends' ? queryKeys.feed.friends(viewerId ?? 'anonymous') : queryKeys.feed.community(),
    queryFn: ({ pageParam }) => fetchFeedPage(scope, pageParam),
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.next,
    enabled: viewerId !== null,
    staleTime: 30_000,
  });
}

export function useTrendingGames() {
  return useQuery({ queryKey: queryKeys.feed.trendingGames(), queryFn: () => fetchTrendingGames(), staleTime: 5 * 60_000 });
}

export function useTrendingPosts() {
  return useQuery({ queryKey: queryKeys.feed.trendingPosts(), queryFn: () => fetchTrendingPosts(), staleTime: 5 * 60_000 });
}
