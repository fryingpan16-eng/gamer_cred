import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCStarRating } from '@/components/ui';
import { PERFECT_TIER_GOLD, STARS_MAX, type RatingScale } from '@/constants/ratingRubric';
import { HERO_SCORE } from '@/constants/scoreBox';
import { useThemeColors } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';
import { mix, readableTintAlpha } from '@/utils/color';
import {
  deriveAllScales,
  formatNumeric,
  formatRounded,
  formatStars,
  tierDefinition,
  tierDefinitionForNumeric,
  type StoredRating,
  tierBorderColor,
  tierSpokenName,
} from '@/utils/rating';

/** Light hairline between the scales in a score box. */
export const SCALE_DIVIDER = 'rgba(255,255,255,0.16)';

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
  const valueClass = cn('text-retrogamingpc-text-bright', big ? HERO_SCORE.valueClass : 'font-mono font-bold text-[16px] leading-[19px]');
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
        <View className="flex-row flex-wrap items-center gap-1.5">
          <RetroGamingPCStarRating
            stars={derived.stars}
            size={big ? HERO_SCORE.starGlyph : 16}
            cell={big ? HERO_SCORE.starCell : undefined}
            showValue={false}
          />
          <Text className={valueClass} style={derived.stars >= STARS_MAX ? { color: PERFECT_TIER_GOLD } : undefined}>
            {formatStars(derived.stars)}
          </Text>
        </View>
      );
    case 'tier': {
      const def = tierDefinition(derived.tier);
      return (
        <View className="flex-row flex-wrap items-center gap-1.5">
          <View
            className={cn('items-center justify-center border', big ? 'min-w-[48px] px-2 py-0.5' : 'min-w-[34px] px-1.5 py-px')}
            style={{ backgroundColor: def.color, borderColor: tierBorderColor(def.tier) }}
          >
            <Text
              className={cn('font-mono font-bold', big ? 'text-[24px] leading-[28px]' : 'text-[15px] leading-[18px]')}
              style={{ color: def.textColor }}
            >
              {def.label}
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
  /** Draw a divider above the first row too (when something sits above it, e.g. the quick-rating control). */
  dividerBeforeFirst?: boolean;
  className?: string;
};

/**
 * A score in several scales at once: the default scale large, then 1–100,
 * stars and tier at a readable size. Unrated shows "--" so the box keeps its shape.
 */
export function ScoreScales({
  rating,
  primaryScale,
  numericText,
  omitPrimary = false,
  dividerBeforeFirst = false,
  className,
}: ScoreScalesProps) {
  const scales = scoreBoxScales(primaryScale);
  const shown = omitPrimary ? scales.slice(1) : scales;
  return (
    <View className={className}>
      {shown.map((scale, i) => {
        const primary = scale === primaryScale;
        const divided = i > 0 || dividerBeforeFirst;
        return (
          <View
            key={scale}
            className={cn('flex-row items-center gap-2 py-1.5', divided && 'border-t')}
            style={[divided ? { borderTopColor: SCALE_DIVIDER } : null, primary ? { minHeight: HERO_SCORE.rowHeight } : null]}
          >
            {primary ? null : <Text className="w-10 text-retrogamingpc-xs text-retrogamingpc-text-muted">{LABELS[scale]}</Text>}
            <ScaleValue scale={scale} rating={rating} numericText={numericText} emphasis={primary ? 'primary' : 'secondary'} />
          </View>
        );
      })}
    </View>
  );
}

/** Theme surface + text colours the tint must stay readable against. */
type TintBase = { dark: string; text: string; textMuted: string };

/**
 * Border, accent bar and background for a score box, from the tier of its
 * score. The background is the strongest tint of the tier colour that keeps
 * the box's text at the app's contrast minimums (≥ 7:1 body, ≥ 4.5:1 muted).
 */
export function tierBoxStyle(rating: StoredRating | null, base: TintBase) {
  if (!rating) return undefined;
  const { color } = tierDefinitionForNumeric(rating.numeric);
  const alpha = readableTintAlpha(color, base.dark, { body: base.text, muted: base.textMuted });
  return { borderColor: color, borderLeftColor: color, backgroundColor: mix(color, base.dark, alpha) };
}

/**
 * A game-page score box colour-coded to the tier of its score (border, left
 * accent bar and a strong, still-readable tint). Unrated boxes keep the plain sunken look.
 * Text stays neutral, so it reads the same on every tier.
 */
export function TierScoreBox({ rating, title, children }: { rating: StoredRating | null; title: string; children: ReactNode }) {
  const themeColors = useThemeColors();
  const style = tierBoxStyle(rating, themeColors);
  const tierLabel = rating ? tierDefinitionForNumeric(rating.numeric) : null;
  return (
    <View
      className={cn(
        'min-w-[200px] flex-1 bg-retrogamingpc-dark px-2 pb-1 pt-2',
        style ? 'border-2 border-l-[6px]' : 'retrogamingpc-bevel-inset',
      )}
      style={style}
      accessibilityLabel={tierLabel ? `${title}, tier ${tierSpokenName(tierLabel.tier)}` : title}
    >
      {children}
    </View>
  );
}
