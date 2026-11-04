import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { platformInfo } from '@/constants/platforms';
import { useFriendRatingsForGame } from '@/hooks/useGameDetail';
import { reviewRating } from '@/utils/ratingColumns';

/**
 * Your friends' ratings of this game (quick ratings and reviews — one score
 * per friend). Tapping the card opens the review browser on its Friends tab.
 */
export function FriendRatings({ gameId }: { gameId: number }) {
  const friends = useFriendRatingsForGame(gameId);
  const openFriends = () => router.push({ pathname: '/reviews/[gameId]', params: { gameId: String(gameId), tab: 'friends' } });
  const any = (friends.data?.length ?? 0) > 0;

  return (
    <RetroGamingPCPanel
      title={`Friends' Ratings${friends.data?.length ? ` (${friends.data.length})` : ''}`}
      onTitlePress={any ? openFriends : undefined}
      titleAccessibilityLabel="Friends' ratings. Open your friends' reviews"
      headerRight={any ? <RetroGamingPCButton variant="navigate" label="View all ▸" onPress={openFriends} /> : undefined}
    >
      {friends.isPending ? (
        <RetroGamingPCSpinner label="Loading friends' ratings…" />
      ) : friends.isError ? (
        <RetroGamingPCAlert message={friends.error.message} />
      ) : friends.data.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">None of your friends have rated this yet.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
          {friends.data.map((f) => (
            <Pressable
              key={f.user_id}
              accessibilityRole="link"
              accessibilityLabel={`${f.username}. Open your friends' reviews`}
              onPress={openFriends}
              className="w-[92px] items-center gap-1"
            >
              <Thumbnail uri={f.avatar_url} fallback={f.username} shape="square" accessibilityLabel="" />
              <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
                {f.username}
              </Text>
              <View pointerEvents="none">
                <RetroGamingPCRating rating={reviewRating(f)} size="compact" expanded={false} />
              </View>
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={1}>
                {f.platform_id !== null ? `on ${platformInfo(f.platform_id).short}` : ''}
                {f.review_id ? `${f.platform_id !== null ? ' · ' : ''}Review` : ''}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </RetroGamingPCPanel>
  );
}
