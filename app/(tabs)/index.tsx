import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCard, RetroGamingPCSpinner, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useActivityFeed } from '@/hooks/useFeed';
import { useGameLookup } from '@/hooks/useGames';
import type { FeedScope } from '@/services/feed';
import { useThemeColors } from '@/hooks/useTheme';

const SCOPE_TABS: readonly RetroGamingPCTabItem<FeedScope>[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'community', label: 'Community' },
];

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

/** Home: retro activity stream — what friends are playing and reviewing, or the whole community. */
export default function HomeScreen() {
  const themeColors = useThemeColors();
  const { user, profile } = useAuth();
  const [scope, setScope] = useState<FeedScope>('friends');
  const feed = useActivityFeed(scope);

  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const games = useGameLookup(items.map((i) => i.game_id));

  const empty =
    scope === 'friends' ? (
      <View className="retrogamingpc-bevel-inset items-center gap-2 bg-retrogamingpc-dark px-4 py-6">
        <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text">No friend activity yet</Text>
        <Text className="text-center text-retrogamingpc-sm text-retrogamingpc-text-muted">
          Add friends to see what they&apos;re playing and reviewing — or browse the community feed.
        </Text>
        <View className="flex-row gap-2">
          <RetroGamingPCButton variant="navigate" label="Find Friends" onPress={() => router.push('/search')} />
          <RetroGamingPCButton variant="navigate" label="Community Feed" onPress={() => setScope('community')} />
        </View>
      </View>
    ) : (
      <View className="retrogamingpc-bevel-inset items-center gap-2 bg-retrogamingpc-dark px-4 py-6">
        <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text">Nothing published yet</Text>
        <RetroGamingPCButton variant="create" label="Write the first review" onPress={() => router.push('/post')} />
      </View>
    );

  return (
    <FlatList
      className="flex-1 bg-retrogamingpc-dark"
      contentContainerClassName="w-full gap-2 self-center p-3 md:max-w-[860px]"
      data={feed.isPending || feed.isError ? [] : items}
      keyExtractor={(item) => item.item_key}
      renderItem={({ item }) => <FeedItemCard item={item} game={games.data?.get(item.game_id)} viewerId={user?.id ?? null} />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          tintColor={themeColors.highlight}
          colors={[themeColors.highlight]}
        />
      }
      ListHeaderComponent={
        <View className="gap-2 pb-1">
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
            Welcome back, <Text className="font-bold text-retrogamingpc-text-bright">{profile?.username ?? 'player'}</Text>.
          </Text>
          <RetroGamingPCTabs items={SCOPE_TABS} value={scope} onChange={setScope} />
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
