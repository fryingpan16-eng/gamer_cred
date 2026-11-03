import { Text, View } from 'react-native';

import { RetroGamingPCBarChart, RetroGamingPCBadge } from '@/components/ui';
import { RATING_SCALE_LABELS } from '@/constants/ratingRubric';
import { usePrimaryRatingScale } from '@/hooks/useAuth';
import { useRatingHistogram } from '@/hooks/useStats';
import { distributionsByScale, ratingTendency, summarizeHistogram } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const TENDENCY = {
  harsh: { label: 'Tough critic', text: 'You rate below the middle of the scale more often than not.' },
  balanced: { label: 'Balanced critic', text: 'Your scores spread across the scale.' },
  generous: { label: 'Generous critic', text: 'Most games you log earn an A or better from you.' },
} as const;

/** How often you give each score, in your primary scale — are you harsh or generous? */
export function RatingDistributionStat() {
  const scale = usePrimaryRatingScale();
  const query = useRatingHistogram();
  const rows = query.data ?? [];
  const summary = summarizeHistogram(rows);
  const tendency = ratingTendency(summary.averageNumeric);
  const dist = distributionsByScale(rows).find((d) => d.scale === scale)!;

  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={summary.count === 0} onRetry={() => void query.refetch()} emptyMessage="Rate some games to see this.">
      <View className="gap-3">
        <View className="flex-row flex-wrap items-center gap-2">
          {tendency ? <RetroGamingPCBadge label={TENDENCY[tendency].label} variant="main" /> : null}
          <Text className="font-mono text-retrogamingpc-sm text-retrogamingpc-text-bright">
            avg {summary.averageNumeric?.toFixed(1)} · median {summary.medianNumeric} · {summary.count} rated
          </Text>
        </View>
        {tendency ? <Text className="text-retrogamingpc-sm text-retrogamingpc-text">{TENDENCY[tendency].text}</Text> : null}
        <RetroGamingPCBarChart title={`Your scores (${RATING_SCALE_LABELS[scale]})`} data={dist.bars} orientation={dist.orientation} labelWidth={dist.orientation === 'horizontal' ? (scale === 'tier' ? 48 : 32) : undefined} maxHeight={scale === 'numeric' ? 640 : undefined} />
      </View>
    </StatFrame>
  );
}
