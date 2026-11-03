import { Text, View } from 'react-native';

import { RetroGamingPCBarChart } from '@/components/ui';
import type { RatingScale } from '@/constants/ratingRubric';
import { useRatingHistogram } from '@/hooks/useStats';
import { distributionsByScale, summarizeHistogram } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const NOTE: Record<RatingScale, string> = {
  numeric: 'Every score from 100 down to 1 gets its own row.',
  tier: 'Your ratings as a tier list, best at the top.',
  stars: 'Your ratings in half-star steps.',
  rounded: 'Your ratings rounded to a score out of 10.',
};

/**
 * One rating scale's distribution + average. Every rating converts to all four
 * scales, so each scale's tab shows the same games.
 */
export function RatingScaleStat({ scale }: { scale: RatingScale }) {
  const query = useRatingHistogram();
  const rows = query.data ?? [];
  const { count } = summarizeHistogram(rows);
  const dist = distributionsByScale(rows).find((d) => d.scale === scale)!;
  const horizontal = dist.orientation === 'horizontal';

  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={count === 0} onRetry={() => void query.refetch()} emptyMessage="Rate some games to see this.">
      <View className="gap-2">
        <View className="flex-row flex-wrap items-baseline justify-between gap-2">
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            {NOTE[scale]} {count} rated game{count === 1 ? '' : 's'}.
          </Text>
          <Text className="font-mono text-retrogamingpc-sm text-retrogamingpc-text-bright">avg {dist.averageLabel ?? '—'}</Text>
        </View>
        <RetroGamingPCBarChart
          title={`${dist.title} distribution`}
          data={dist.bars}
          orientation={dist.orientation}
          labelWidth={horizontal ? (scale === 'tier' ? 48 : 32) : undefined}
          maxHeight={scale === 'numeric' ? 640 : undefined}
        />
      </View>
    </StatFrame>
  );
}

export const NumericRatingsStat = () => <RatingScaleStat scale="numeric" />;
export const TierRatingsStat = () => <RatingScaleStat scale="tier" />;
export const StarRatingsStat = () => <RatingScaleStat scale="stars" />;
export const RoundedRatingsStat = () => <RatingScaleStat scale="rounded" />;
