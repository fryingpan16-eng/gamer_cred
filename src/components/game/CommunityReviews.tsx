import { PERFECT_TIER_GOLD } from '@/constants/ratingRubric';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { ReviewCard } from '@/components/review/ReviewCard';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useMemberId } from '@/hooks/useAuth';
import { useGameReviewStats } from '@/hooks/useGameDetail';
import { useReviewLikes, useReviewPreview } from '@/hooks/useReviewBrowser';
import type { GameReviewStats } from '@/services/games';

import { tierDefinition, tierHistogram, tierLabel, tierSpokenName } from '@/utils/rating';

/**
 * Tier histogram, F → S, bars in the rubric's tier colours. Perfect 100s are part
 * of the S bar, shown as its gold top portion (and counted in the legend).
 */
function Distribution({ stats }: { stats: GameReviewStats }) {
  const buckets = tierHistogram(stats.distribution);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const perfect = buckets.find((b) => b.perfect > 0)?.perfect ?? 0;
  return (
    <View className="flex-1 gap-1">
      <View
        className="h-16 flex-row items-end gap-px"
        accessibilityLabel={`Tier distribution: ${buckets
          .map((b) => `${tierSpokenName(b.tier)} ${b.count}${b.perfect > 0 ? `, ${b.perfect} of them perfect` : ''}`)
          .join(', ')}`}
      >
        {buckets.map(({ tier, count, perfect: gold }) => (
          <View key={tier} className="flex-1 items-center justify-end">
            <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{count > 0 ? count : ''}</Text>
            <View
              className="w-full justify-start overflow-hidden"
              style={{
                height: `${Math.max(4, (count / max) * 70)}%`,
                backgroundColor: tierDefinition(tier).color,
                opacity: count === 0 ? 0.25 : 1,
              }}
            >
              {/* Perfect 100s: the gold top of the S bar. */}
              {gold > 0 ? <View style={{ height: `${(gold / count) * 100}%`, backgroundColor: PERFECT_TIER_GOLD }} /> : null}
            </View>
            <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{tierLabel(tier)}</Text>
          </View>
        ))}
      </View>
      {perfect > 0 ? (
        <View className="flex-row items-center gap-1">
          <View className="h-2 w-2" style={{ backgroundColor: PERFECT_TIER_GOLD }} />
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            <Text className="font-bold" style={{ color: PERFECT_TIER_GOLD }}>
              {perfect}
            </Text>{' '}
            perfect 100{perfect === 1 ? '' : 's'} (in S)
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const PREVIEW = 3;

/** Tier distribution + the most popular few reviews; View all opens the review browser. */
export function CommunityReviews({ gameId }: { gameId: number }) {
  const viewerId = useMemberId();
  const stats = useGameReviewStats(gameId);
  const preview = useReviewPreview(gameId, 'popular', PREVIEW);
  const reviews = preview.data?.reviews ?? [];
  const likes = useReviewLikes(reviews.map((r) => r.id));
  const openAll = () => router.push({ pathname: '/reviews/[gameId]', params: { gameId: String(gameId), tab: 'community' } });
  const total = stats.data?.count ?? 0;

  return (
    <RetroGamingPCPanel
      title={`Community Reviews${stats.data ? ` (${total})` : ''}`}
      onTitlePress={openAll}
      titleAccessibilityLabel="Community reviews. Open all reviews"
      headerRight={<RetroGamingPCButton variant="navigate" label="View all ▸" onPress={openAll} />}
    >
      <View className="gap-3">
        {stats.data && total > 0 ? (
          <View className="retrogamingpc-bevel-inset flex-row items-center gap-3 bg-retrogamingpc-dark p-2">
            <Distribution stats={stats.data} />
          </View>
        ) : null}

        {preview.isPending ? (
          <RetroGamingPCSpinner label="Loading reviews…" />
        ) : preview.isError ? (
          <View className="gap-2">
            <RetroGamingPCAlert message={preview.error.message} />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void preview.refetch()} />
            </View>
          </View>
        ) : reviews.length === 0 ? (
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No reviews yet. Be the first to post one.</Text>
        ) : (
          <View className="gap-2">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} viewerId={viewerId} like={likes.data?.get(review.id)} />
            ))}
            <View className="flex-row justify-center pt-1">
              <RetroGamingPCButton variant="navigate" label="See all reviews" onPress={openAll} />
            </View>
          </View>
        )}
      </View>
    </RetroGamingPCPanel>
  );
}
