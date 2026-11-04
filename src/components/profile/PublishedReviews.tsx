import { Text, View } from 'react-native';

import { ReviewCard } from '@/components/review/ReviewCard';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useMemberId } from '@/hooks/useAuth';
import { useGameLookup } from '@/hooks/useGames';
import { usePublishedReviews } from '@/hooks/useProfile';
import { useReviewLikes } from '@/hooks/useReviewBrowser';
import { cardFromReview } from '@/services/reviewBrowser';

/** A player's published reviews (RLS hides their drafts from everyone else). */
export function PublishedReviews({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const reviews = usePublishedReviews(userId);
  const games = useGameLookup((reviews.data ?? []).map((r) => r.game_id));
  const likes = useReviewLikes((reviews.data ?? []).map((r) => r.id));
  const viewerId = useMemberId();

  return (
    <RetroGamingPCPanel title={`Reviews${reviews.data ? ` (${reviews.data.length})` : ''}`}>
      {reviews.isPending ? (
        <RetroGamingPCSpinner label="Loading reviews…" />
      ) : reviews.isError ? (
        <RetroGamingPCAlert message={reviews.error.message} />
      ) : reviews.data.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          {isOwner ? 'You haven’t published a review yet. Head to the Review Studio.' : 'No published reviews yet.'}
        </Text>
      ) : (
        <View className="gap-2">
          {reviews.data.map((review) => (
            <ReviewCard
              key={review.id}
              review={cardFromReview(review)}
              viewerId={viewerId}
              like={likes.data?.get(review.id)}
              showGame
              showAuthor={false}
              game={games.data?.get(review.game_id)}
              excerptLines={3}
            />
          ))}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
