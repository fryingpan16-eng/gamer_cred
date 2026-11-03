import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { platformInfo } from '@/constants/platforms';
import { useFriendRatingsForGame } from '@/hooks/useGameDetail';
import { reviewRating } from '@/utils/ratingColumns';

/**
 * Your friends' ratings of this game (quick ratings and reviews — one score
 * per friend), shown before other community reviews. Tap opens their review
 * when they wrote one, otherwise their profile.
 */
export function FriendRatings({ gameId }: { gameId: number }) {
  const friends = useFriendRatingsForGame(gameId);

  return (
    <RetroGamingPCPanel title={`Friends' Ratings${friends.data?.length ? ` (${friends.data.length})` : ''}`}>
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
              accessibilityLabel={f.review_id ? `${f.username}'s review` : `${f.username}'s profile`}
              onPress={() =>
                f.review_id
                  ? router.push({ pathname: '/review/[id]', params: { id: f.review_id } })
                  : router.push({ pathname: '/user/[id]', params: { id: f.user_id } })
              }
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
