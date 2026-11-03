import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { HomeFeed } from '@/components/home/HomeFeed';
import { TrendingGames } from '@/components/home/TrendingGames';
import { TrendingPosts } from '@/components/home/TrendingPosts';
import { FeaturedListsPanel, ListBrowser, YourListsPanel } from '@/components/lists/HomeLists';
import { RetroGamingPCButton, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { queryKeys } from '@/utils/queryKeys';

type HomeTab = 'community' | 'friends' | 'lists';

const HOME_TABS: readonly RetroGamingPCTabItem<HomeTab>[] = [
  { key: 'community', label: 'Community' },
  { key: 'friends', label: 'Friends' },
  { key: 'lists', label: 'Lists' },
];

const isHomeTab = (v: string | undefined): v is HomeTab => HOME_TABS.some((t) => t.key === v);

function EmptyBox({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <View className="retrogamingpc-bevel-inset items-center gap-2 bg-retrogamingpc-dark px-4 py-6">
      <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text">{title}</Text>
      {body ? <Text className="text-center text-retrogamingpc-sm text-retrogamingpc-text-muted">{body}</Text> : null}
      {children}
    </View>
  );
}

/** Community: trending games, trending posts, then everyone's latest reviews. */
function CommunityTab() {
  const queryClient = useQueryClient();
  return (
    <HomeFeed
      scope="community"
      onRefreshHeader={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feed.trendingGames() });
        void queryClient.invalidateQueries({ queryKey: queryKeys.feed.trendingPosts() });
      }}
      header={
        <View className="gap-2">
          <TrendingGames />
          <TrendingPosts />
          <Text className="retrogamingpc-heading pt-1">Latest from the Community</Text>
        </View>
      }
      empty={
        <EmptyBox title="Nothing published yet">
          <RetroGamingPCButton variant="create" label="Write the first review" onPress={() => router.push('/post')} />
        </EmptyBox>
      }
    />
  );
}

/** Friends: what your friends are playing and reviewing. */
function FriendsTab() {
  return (
    <HomeFeed
      scope="friends"
      empty={
        <EmptyBox title="No friend activity yet" body="Add friends to see what they're playing and reviewing.">
          <RetroGamingPCButton variant="navigate" label="Find Friends" onPress={() => router.push({ pathname: '/search', params: { tab: 'users' } })} />
        </EmptyBox>
      }
    />
  );
}

/** Lists: curated lists, your lists (+ New List), and a browser for community lists. */
function ListsTab() {
  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets className="flex-1" contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[860px]" keyboardShouldPersistTaps="handled">
      <FeaturedListsPanel />
      <YourListsPanel />
      <ListBrowser />
    </ScrollView>
  );
}

/**
 * Home: one tab bar at the top — Community (trending + latest), Friends
 * (friends' activity) and Lists (curated, yours, browse). `?tab=` deep-links.
 */
export default function HomeScreen() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const active: HomeTab = isHomeTab(tab) ? tab : 'community';

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <View className="border-b border-b-retrogamingpc-accent px-3 pt-3 pb-2">
        <View className="w-full self-center md:max-w-[860px]">
          <RetroGamingPCTabs items={HOME_TABS} value={active} onChange={(next) => router.setParams({ tab: next })} fill />
        </View>
      </View>
      {/* Only the visible tab is mounted, so only its data loads. */}
      {active === 'community' ? <CommunityTab /> : null}
      {active === 'friends' ? <FriendsTab /> : null}
      {active === 'lists' ? <ListsTab /> : null}
    </View>
  );
}
