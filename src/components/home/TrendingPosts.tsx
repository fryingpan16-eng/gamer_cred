import { Text, View } from 'react-native';

import { FeedItemCard } from '@/components/feed/FeedItemCard';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useTrendingPosts } from '@/hooks/useFeed';
import { useGameLookup } from '@/hooks/useGames';

/** Recent reviews of the games that are trending right now. */
export function TrendingPosts() {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const posts = useTrendingPosts();
  const rows = posts.data ?? [];
  const games = useGameLookup(rows.map((r) => r.game_id));

  return (
    <RetroGamingPCPanel title="Trending Posts">
      {posts.isPending ? (
        <RetroGamingPCSpinner label="Loading trending posts…" />
      ) : posts.isError ? (
        <RetroGamingPCAlert message={posts.error.message} />
      ) : rows.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No trending reviews yet.</Text>
      ) : (
        <View className="gap-2">
          {rows.map((item) => (
            <FeedItemCard key={item.item_key} item={item} game={games.data?.get(item.game_id)} viewerId={viewerId} />
          ))}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
