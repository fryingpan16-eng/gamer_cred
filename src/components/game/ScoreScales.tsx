import { Text, View } from 'react-native';

import { RetroGamingPCStarRating } from '@/components/ui';
import type { RatingScale } from '@/constants/ratingRubric';
import { cn } from '@/utils/cn';
import { deriveAllScales, formatNumeric, formatRounded, formatStars, tierDefinition, type StoredRating } from '@/utils/rating';

/**
 * Which scales a game-page score box shows, in order: the viewer's default
 * first, then 1–100, stars and tier (always). Rounded /10 appears only when it
 * is the default.
 */
export function scoreBoxScales(primary: RatingScale): RatingScale[] {
  const always: RatingScale[] = ['numeric', 'stars', 'tier'];
  return [primary, ...always.filter((s) => s !== primary)];
}

const LABELS: Record<RatingScale, string> = { numeric: '1–100', stars: 'Stars', tier: 'Tier', rounded: 'Rounded' };

type Emphasis = 'primary' | 'secondary';

function ScaleValue({
  scale,
  rating,
  numericText,
  emphasis,
}: {
  scale: RatingScale;
  rating: StoredRating | null;
  numericText?: string;
  emphasis: Emphasis;
}) {
  const big = emphasis === 'primary';
  const valueClass = cn('font-mono font-bold text-retrogamingpc-text-bright', big ? 'text-[28px] leading-[32px]' : 'text-[16px] leading-[19px]');
  const unitClass = cn('font-mono text-retrogamingpc-text-muted', big ? 'text-retrogamingpc-lg' : 'text-retrogamingpc-sm');

  if (!rating) return <Text className={cn(valueClass, 'text-retrogamingpc-text-muted')}>--</Text>;
  const derived = deriveAllScales(rating.numeric);

  switch (scale) {
    case 'numeric':
      return (
        <Text className={valueClass}>
          {numericText ?? formatNumeric(rating)}
          <Text className={unitClass}> /100</Text>
        </Text>
      );
    case 'stars':
      return (
        <View className="flex-row items-center gap-1.5">
          <RetroGamingPCStarRating stars={derived.stars} size={big ? 24 : 16} showValue={false} />
          <Text className={valueClass}>{formatStars(derived.stars)}</Text>
        </View>
      );
    case 'tier': {
      const def = tierDefinition(derived.tier);
      return (
        <View className="flex-row flex-wrap items-center gap-1.5">
          <View
            className={cn('items-center justify-center border', big ? 'min-w-[48px] px-2 py-0.5' : 'min-w-[34px] px-1.5 py-px')}
            style={{ backgroundColor: def.color, borderColor: def.tier === 'S**' ? '#E6D8FF' : 'rgba(0,0,0,0.35)' }}
          >
            <Text className={cn('font-mono font-bold', big ? 'text-[24px] leading-[28px]' : 'text-[15px] leading-[18px]')} style={{ color: def.textColor }}>
              {def.tier}
            </Text>
          </View>
          <Text className={cn('text-retrogamingpc-text', big ? 'text-retrogamingpc-lg' : 'text-retrogamingpc-base')}>{def.descriptor}</Text>
        </View>
      );
    }
    case 'rounded':
      return <Text className={valueClass}>{formatRounded(derived.rounded)}</Text>;
  }
}

export type ScoreScalesProps = {
  rating: StoredRating | null;
  primaryScale: RatingScale;
  /** Exact text for the 1–100 value (e.g. a community average "84.3"). */
  numericText?: string;
  /** Leave the primary scale out (the caller renders it, e.g. as the quick-rating control). */
  omitPrimary?: boolean;
  className?: string;
};

/**
 * A score in several scales at once: the default scale large, then 1–100,
 * stars and tier at a readable size. Unrated shows "--" so the box keeps its shape.
 */
export function ScoreScales({ rating, primaryScale, numericText, omitPrimary = false, className }: ScoreScalesProps) {
  const scales = scoreBoxScales(primaryScale);
  const shown = omitPrimary ? scales.slice(1) : scales;
  return (
    <View className={cn('gap-1.5', className)}>
      {shown.map((scale) => {
        const primary = scale === primaryScale;
        return (
          <View key={scale} className="flex-row items-center gap-2">
            {primary ? null : <Text className="w-10 text-retrogamingpc-xs text-retrogamingpc-text-muted">{LABELS[scale]}</Text>}
            <ScaleValue scale={scale} rating={rating} numericText={numericText} emphasis={primary ? 'primary' : 'secondary'} />
          </View>
        );
      })}
    </View>
  );
}
