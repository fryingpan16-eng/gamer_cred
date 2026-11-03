import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCCard, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useFriendReviewsForGame, useGameReviews, useGameReviewStats } from '@/hooks/useGameDetail';
import type { GameReview, GameReviewStats } from '@/services/games';

import { PlayedOnBadge } from './PlayedOnBadge';
import { bucketByTier, tierDefinition } from '@/utils/rating';
import { reviewRating } from '@/utils/ratingColumns';

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/** Tier histogram (F → S**), bars in the rubric's tier colours. */
function Distribution({ stats }: { stats: GameReviewStats }) {
  const buckets = bucketByTier(stats.distribution).reverse();
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <View
      className="h-16 flex-1 flex-row items-end gap-px"
      accessibilityLabel={`Tier distribution: ${buckets.map((b) => `${b.tier} ${b.count}`).join(', ')}`}
    >
      {buckets.map(({ tier, count }) => (
        <View key={tier} className="flex-1 items-center justify-end">
          <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{count > 0 ? count : ''}</Text>
          <View
            className="w-full"
            style={{
              height: `${Math.max(4, (count / max) * 70)}%`,
              backgroundColor: tierDefinition(tier).color,
              opacity: count === 0 ? 0.25 : 1,
            }}
          />
          <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{tier}</Text>
        </View>
      ))}
    </View>
  );
}

function ReviewCard({ review, isMine }: { review: GameReview; isMine: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const author = review.author;
  const openAuthor = () => author && router.push(isMine ? '/profile' : { pathname: '/user/[id]', params: { id: author.id } });
  const long = (review.content?.length ?? 0) > 320;

  return (
    <RetroGamingPCCard className="gap-2">
      <View className="flex-row items-center gap-2">
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${author?.username ?? 'player'}'s profile`} onPress={openAuthor}>
          <Thumbnail uri={author?.avatar_url ?? null} fallback={author?.username ?? '?'} shape="square" accessibilityLabel="" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1">
            <Text onPress={openAuthor} className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
              {author?.username ?? 'Unknown player'}
            </Text>
            {isMine ? <RetroGamingPCBadge label="You" variant="nowPlaying" /> : null}
          </View>
          <RetroGamingPCRating rating={reviewRating(review)} size="compact" />
          <PlayedOnBadge platformId={review.platform_id} />
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{formatDate(review.published_at)}</Text>
        </View>
      </View>
      {review.content ? (
        <>
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text" numberOfLines={expanded ? undefined : 6}>
            {review.content}
          </Text>
          {long ? (
            <Text onPress={() => setExpanded((v) => !v)} className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          ) : null}
        </>
      ) : (
        <Text className="text-retrogamingpc-xs italic text-retrogamingpc-text-muted">Score-only review (no written text).</Text>
      )}
    </RetroGamingPCCard>
  );
}

/** Tier distribution + paginated published reviews from everyone except your friends (shown above). */
export function CommunityReviews({ gameId }: { gameId: number }) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const stats = useGameReviewStats(gameId);
  const reviews = useGameReviews(gameId);
  // Friends' reviews are shown first in FriendRatings, so they're left out here.
  const friends = useFriendReviewsForGame(gameId);
  const friendIds = new Set((friends.data ?? []).map((f) => f.user_id));
  const all = (reviews.data?.pages.flatMap((p) => p.reviews) ?? []).filter((r) => !friendIds.has(r.user_id));

  return (
    <RetroGamingPCPanel title={`Community Reviews${stats.data ? ` (${stats.data.count})` : ''}`}>
      <View className="gap-3">
        {stats.data && stats.data.count > 0 ? (
          <View className="retrogamingpc-bevel-inset flex-row items-center gap-3 bg-retrogamingpc-dark p-2">
            <Distribution stats={stats.data} />
          </View>
        ) : null}

        {reviews.isPending ? (
          <RetroGamingPCSpinner label="Loading reviews…" />
        ) : reviews.isError ? (
          <View className="gap-2">
            <RetroGamingPCAlert message={reviews.error.message} />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void reviews.refetch()} />
            </View>
          </View>
        ) : all.length === 0 ? (
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
            {friendIds.size > 0 ? 'No other community reviews yet.' : 'No community reviews yet. Be the first to post one.'}
          </Text>
        ) : (
          <View className="gap-2">
            {all.map((review) => (
              <ReviewCard key={review.id} review={review} isMine={review.user_id === viewerId} />
            ))}
            {reviews.hasNextPage ? (
              <View className="flex-row justify-center pt-1">
                <RetroGamingPCButton
                  label={reviews.isFetchingNextPage ? 'Loading…' : 'Load more reviews'}
                  loading={reviews.isFetchingNextPage}
                  onPress={() => void reviews.fetchNextPage()}
                />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </RetroGamingPCPanel>
  );
}
