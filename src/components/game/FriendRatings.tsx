import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { useFriendReviewsForGame } from '@/hooks/useGameDetail';
import { reviewRating } from '@/utils/ratingColumns';

/**
 * Your friends' ratings of this game — shown before other community reviews.
 * Each entry is the friend's picture + rating (in your scale); tap to open their review.
 */
export function FriendRatings({ gameId }: { gameId: number }) {
  const friends = useFriendReviewsForGame(gameId);

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
              key={f.review_id}
              accessibilityRole="link"
              accessibilityLabel={`${f.username}'s review`}
              onPress={() => router.push({ pathname: '/review/[id]', params: { id: f.review_id } })}
              className="w-[92px] items-center gap-1"
            >
              <Thumbnail uri={f.avatar_url} fallback={f.username} shape="square" accessibilityLabel="" />
              <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
                {f.username}
              </Text>
              <View pointerEvents="none">
                <RetroGamingPCRating rating={reviewRating(f)} size="compact" expanded={false} />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </RetroGamingPCPanel>
  );
}
