import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RATING_SCALE_LABELS, type RatingScale } from '@/constants/ratingRubric';
import { usePrimaryRatingScale } from '@/hooks/useAuth';
import { cn } from '@/utils/cn';
import {
  deriveAllScales,
  formatNumeric,
  formatRatingInScale,
  formatRounded,
  formatStars,
  formatTierRange,
  storedRatingInScale,
  type StoredRating,
} from '@/utils/rating';

import { SteamStarRating } from './SteamStarRating';
import { SteamTierBadge } from './SteamTierBadge';

export type SteamRatingProps = {
  rating: StoredRating | null;
  /** Defaults to the viewer's primary scale. */
  scale?: RatingScale;
  size?: 'compact' | 'regular';
  /** Small suffix after the value, e.g. "so far". */
  suffix?: string;
  /** Always show the other scales (otherwise they toggle on tap). */
  expanded?: boolean;
  /** Prefix such as "Avg" for aggregates. */
  prefix?: string;
  className?: string;
};

/**
 * The one way ratings are displayed: the viewer's primary-scale value up front,
 * the tier badge (colour + descriptor), and the other scales as secondary detail
 * (tap to reveal). Numeric scores derived from coarse input show as "~89";
 * S** always shows as exactly 100.
 */
export function SteamRating({ rating, scale: scaleProp, size = 'regular', suffix, expanded: forceExpanded = false, prefix, className }: SteamRatingProps) {
  const primary = usePrimaryRatingScale();
  const scale = scaleProp ?? primary;
  const [open, setOpen] = useState(false);

  if (!rating) {
    return <Text className={cn('font-mono text-steam-xs text-steam-text-muted', className)}>Unrated</Text>;
  }

  const derived = deriveAllScales(rating.numeric);
  const compact = size === 'compact';
  const showDetail = forceExpanded || open;

  const primaryValue =
    scale === 'stars' ? (
      <SteamStarRating stars={storedRatingInScale(rating, 'stars').value as number} size={compact ? 11 : 14} showValue={!compact} />
    ) : scale === 'tier' ? null : (
      <Text className={cn('font-mono font-bold text-steam-text-bright', compact ? 'text-steam-sm' : 'text-steam-lg')}>
        {formatRatingInScale(rating, scale)}
      </Text>
    );

  const secondary = [
    { scale: 'numeric' as const, text: `${formatNumeric(rating)} (${formatTierRange(derived.tier)})` },
    { scale: 'tier' as const, text: derived.tier },
    { scale: 'stars' as const, text: formatStars(derived.stars) },
    { scale: 'rounded' as const, text: formatRounded(derived.rounded) },
  ].filter((s) => s.scale !== scale);

  const a11y = `${prefix ? `${prefix} ` : ''}${formatRatingInScale(rating, scale)}, tier ${derived.tier} ${derived.descriptor}. ${secondary.map((s) => s.text).join(', ')}`;

  const body = (
    <View className="gap-0.5">
      <View className="flex-row flex-wrap items-center gap-1.5">
        {prefix ? <Text className="text-steam-xs text-steam-text-muted">{prefix}</Text> : null}
        {primaryValue}
        <SteamTierBadge tier={derived.tier} showDescriptor={!compact || scale === 'tier'} size={compact ? 'compact' : 'regular'} />
        {suffix ? <Text className="text-steam-xs text-steam-text-muted">{suffix}</Text> : null}
        {!forceExpanded ? <Text className="text-steam-xs text-steam-text-muted">{open ? '▾' : '▸'}</Text> : null}
      </View>
      {showDetail ? (
        <Text className="font-mono text-steam-xs text-steam-text-muted">
          {secondary.map((s) => s.text).join(' · ')}
          {rating.inputScale !== scale ? `  (entered as ${RATING_SCALE_LABELS[rating.inputScale].split(' ')[0]}: ${rating.input})` : ''}
        </Text>
      ) : null}
    </View>
  );

  if (forceExpanded) {
    return (
      <View className={className} accessibilityLabel={a11y}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      className={className}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Shows this rating in the other scales"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen((v) => !v)}
      hitSlop={4}
    >
      {body}
    </Pressable>
  );
}
