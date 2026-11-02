import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { SteamAlert, SteamButton, SteamCard, SteamSpinner, SteamTabs, type SteamTabItem } from '@/components/ui';
import { steamColors } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { useActivityFeed } from '@/hooks/useFeed';
import { useGameLookup } from '@/hooks/useGames';
import type { FeedScope } from '@/services/feed';

const SCOPE_TABS: readonly SteamTabItem<FeedScope>[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'community', label: 'Community' },
];

function FeedSkeleton() {
  return (
    <View className="gap-2">
      <SteamSpinner label="Loading activity…" />
      {[0, 1, 2].map((i) => (
        <SteamCard key={i} className="flex-row gap-3 opacity-60">
          <View className="steam-bevel-inset h-12 w-12 bg-steam-dark" />
          <View className="flex-1 gap-2 py-1">
            <View className="h-3 w-3/4 bg-steam-panel" />
            <View className="h-2 w-1/3 bg-steam-panel" />
          </View>
          <View className="steam-bevel-inset h-16 w-12 bg-steam-dark" />
        </SteamCard>
      ))}
    </View>
  );
}

/** Home: retro activity stream — what friends are playing and reviewing, or the whole community. */
export default function HomeScreen() {
  const { user, profile } = useAuth();
  const [scope, setScope] = useState<FeedScope>('friends');
  const feed = useActivityFeed(scope);

  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const games = useGameLookup(items.map((i) => i.game_id));

  const empty =
    scope === 'friends' ? (
      <View className="steam-bevel-inset items-center gap-2 bg-steam-dark px-4 py-6">
        <Text className="text-steam-base font-bold text-steam-text">No friend activity yet</Text>
        <Text className="text-center text-steam-sm text-steam-text-muted">
          Add friends to see what they&apos;re playing and reviewing — or browse the community feed.
        </Text>
        <View className="flex-row gap-2">
          <SteamButton label="Find Friends" variant="primary" onPress={() => router.push('/search')} />
          <SteamButton label="Community Feed" onPress={() => setScope('community')} />
        </View>
      </View>
    ) : (
      <View className="steam-bevel-inset items-center gap-2 bg-steam-dark px-4 py-6">
        <Text className="text-steam-base font-bold text-steam-text">Nothing published yet</Text>
        <SteamButton label="Write the first review" variant="primary" onPress={() => router.push('/post')} />
      </View>
    );

  return (
    <FlatList
      className="flex-1 bg-steam-dark"
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
          tintColor={steamColors.highlight}
          colors={[steamColors.highlight]}
        />
      }
      ListHeaderComponent={
        <View className="gap-2 pb-1">
          <Text className="text-steam-sm text-steam-text-muted">
            Welcome back, <Text className="font-bold text-steam-text-bright">{profile?.username ?? 'player'}</Text>.
          </Text>
          <SteamTabs items={SCOPE_TABS} value={scope} onChange={setScope} />
          {feed.isError && items.length > 0 ? <SteamAlert message={`Couldn't refresh — ${feed.error.message}`} /> : null}
        </View>
      }
      ListEmptyComponent={
        feed.isPending ? (
          <FeedSkeleton />
        ) : feed.isError ? (
          <View className="gap-2">
            <SteamAlert message={feed.error.message} />
            <View className="flex-row justify-end">
              <SteamButton label="Retry" onPress={() => void feed.refetch()} />
            </View>
          </View>
        ) : (
          empty
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <SteamSpinner label="Loading older activity…" className="justify-center py-2" />
        ) : items.length > 0 && !feed.hasNextPage ? (
          <Text className="py-2 text-center text-steam-xs text-steam-text-muted">— End of activity —</Text>
        ) : undefined
      }
    />
  );
}
