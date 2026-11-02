import { useInfiniteQuery } from '@tanstack/react-query';

import { fetchFeedPage, type FeedCursor, type FeedScope } from '@/services/feed';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

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
