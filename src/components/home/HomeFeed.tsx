import { useMemo, type ReactElement } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCard, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useActivityFeed } from '@/hooks/useFeed';
import { useGameLookup } from '@/hooks/useGames';
import { useReviewLikes } from '@/hooks/useReviewBrowser';
import { useThemeColors } from '@/hooks/useTheme';
import type { FeedScope } from '@/services/feed';

function FeedSkeleton() {
  return (
    <View className="gap-2">
      <RetroGamingPCSpinner label="Loading activity…" />
      {[0, 1, 2].map((i) => (
        <RetroGamingPCCard key={i} className="flex-row gap-3 opacity-60">
          <View className="retrogamingpc-bevel-inset h-12 w-12 bg-retrogamingpc-dark" />
          <View className="flex-1 gap-2 py-1">
            <View className="h-3 w-3/4 bg-retrogamingpc-panel" />
            <View className="h-2 w-1/3 bg-retrogamingpc-panel" />
          </View>
          <View className="retrogamingpc-bevel-inset h-16 w-12 bg-retrogamingpc-dark" />
        </RetroGamingPCCard>
      ))}
    </View>
  );
}

type HomeFeedProps = {
  scope: FeedScope;
  /** Rendered above the feed items (scrolls with them). */
  header?: ReactElement;
  /** Shown when the feed has no items. */
  empty: ReactElement;
  /** Pull-to-refresh also refreshes whatever the header shows. */
  onRefreshHeader?: () => void;
};

/** Paginated activity feed (friends or community) with pull-to-refresh and infinite scroll. */
export function HomeFeed({ scope, header, empty, onRefreshHeader }: HomeFeedProps) {
  const themeColors = useThemeColors();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const feed = useActivityFeed(scope);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const games = useGameLookup(items.map((i) => i.game_id));
  const likes = useReviewLikes(items.flatMap((i) => (i.review_id ? [i.review_id] : [])));

  return (
    <FlatList
      className="flex-1"
      contentContainerClassName="w-full gap-2 self-center p-3 md:max-w-[860px]"
      data={feed.isPending || feed.isError ? [] : items}
      keyExtractor={(item) => item.item_key}
      renderItem={({ item }) => (
        <FeedItemCard
          item={item}
          game={games.data?.get(item.game_id)}
          viewerId={viewerId}
          like={item.review_id ? likes.data?.get(item.review_id) : undefined}
        />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => {
            void feed.refetch();
            onRefreshHeader?.();
          }}
          tintColor={themeColors.highlight}
          colors={[themeColors.highlight]}
        />
      }
      ListHeaderComponent={
        <View className="gap-2 pb-1">
          {header}
          {feed.isError && items.length > 0 ? <RetroGamingPCAlert message={`Couldn't refresh — ${feed.error.message}`} /> : null}
        </View>
      }
      ListEmptyComponent={
        feed.isPending ? (
          <FeedSkeleton />
        ) : feed.isError ? (
          <View className="gap-2">
            <RetroGamingPCAlert message={feed.error.message} />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void feed.refetch()} />
            </View>
          </View>
        ) : (
          empty
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <RetroGamingPCSpinner label="Loading older activity…" className="justify-center py-2" />
        ) : items.length > 0 && !feed.hasNextPage ? (
          <Text className="py-2 text-center text-retrogamingpc-xs text-retrogamingpc-text-muted">— End of activity —</Text>
        ) : undefined
      }
    />
  );
}
