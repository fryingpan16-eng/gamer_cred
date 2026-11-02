import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { SteamAlert, SteamBadge, SteamButton, SteamCard, SteamPanel, SteamSpinner, SteamStarRating } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useGameReviews, useGameReviewStats } from '@/hooks/useGameDetail';
import type { GameReview, GameReviewStats } from '@/services/games';

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/** 10-bar histogram of community scores. */
function Distribution({ stats }: { stats: GameReviewStats }) {
  const max = Math.max(1, ...stats.distribution);
  return (
    <View className="h-12 flex-1 flex-row items-end gap-px" accessibilityLabel="Score distribution">
      {stats.distribution.map((count, i) => (
        <View key={i} className="flex-1 items-center justify-end">
          <View
            className={i >= 7 ? 'w-full bg-steam-highlight' : 'w-full bg-steam-active'}
            style={{ height: `${Math.max(4, (count / max) * 100)}%`, opacity: count === 0 ? 0.25 : 1 }}
          />
          <Text className="font-mono text-[8px] leading-[10px] text-steam-text-muted">{i + 1}</Text>
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
    <SteamCard className="gap-2">
      <View className="flex-row items-center gap-2">
        <Pressable accessibilityRole="link" accessibilityLabel={`Open ${author?.username ?? 'player'}'s profile`} onPress={openAuthor}>
          <Thumbnail uri={author?.avatar_url ?? null} fallback={author?.username ?? '?'} shape="square" accessibilityLabel="" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1">
            <Text onPress={openAuthor} className="text-steam-base font-bold text-steam-highlight" numberOfLines={1}>
              {author?.username ?? 'Unknown player'}
            </Text>
            {isMine ? <SteamBadge label="You" variant="nowPlaying" /> : null}
          </View>
          <SteamStarRating rating={review.rating} />
          <Text className="text-steam-xs text-steam-text-muted">{formatDate(review.published_at)}</Text>
        </View>
      </View>
      {review.content ? (
        <>
          <Text className="text-steam-sm text-steam-text" numberOfLines={expanded ? undefined : 6}>
            {review.content}
          </Text>
          {long ? (
            <Text onPress={() => setExpanded((v) => !v)} className="text-steam-xs text-steam-highlight underline">
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          ) : null}
        </>
      ) : (
        <Text className="text-steam-xs italic text-steam-text-muted">Score-only quick review.</Text>
      )}
    </SteamCard>
  );
}

/** Community score summary + paginated published reviews for one game. */
export function CommunityReviews({ gameId }: { gameId: number }) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const stats = useGameReviewStats(gameId);
  const reviews = useGameReviews(gameId);
  const all = reviews.data?.pages.flatMap((p) => p.reviews) ?? [];

  return (
    <SteamPanel title={`Community Reviews${stats.data ? ` (${stats.data.count})` : ''}`}>
      <View className="gap-3">
        {stats.data && stats.data.count > 0 ? (
          <View className="steam-bevel-inset flex-row items-center gap-3 bg-steam-dark p-2">
            <View className="items-center gap-1">
              <Text className="font-mono text-[28px] font-bold leading-[30px] text-steam-text-bright">
                {stats.data.average?.toFixed(1) ?? '--'}
              </Text>
              <SteamStarRating rating={stats.data.average} showValue={false} />
            </View>
            <Distribution stats={stats.data} />
          </View>
        ) : null}

        {reviews.isPending ? (
          <SteamSpinner label="Loading reviews…" />
        ) : reviews.isError ? (
          <View className="gap-2">
            <SteamAlert message={reviews.error.message} />
            <View className="flex-row justify-end">
              <SteamButton label="Retry" onPress={() => void reviews.refetch()} />
            </View>
          </View>
        ) : all.length === 0 ? (
          <Text className="text-steam-sm text-steam-text-muted">No community reviews yet. Be the first to post one.</Text>
        ) : (
          <View className="gap-2">
            {all.map((review) => (
              <ReviewCard key={review.id} review={review} isMine={review.user_id === viewerId} />
            ))}
            {reviews.hasNextPage ? (
              <View className="flex-row justify-center pt-1">
                <SteamButton
                  label={reviews.isFetchingNextPage ? 'Loading…' : 'Load more reviews'}
                  loading={reviews.isFetchingNextPage}
                  onPress={() => void reviews.fetchNextPage()}
                />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SteamPanel>
  );
}
