import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import { STARS_MAX, STARS_STEP } from '@/constants/ratingRubric';
import { steamColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

export type SteamStarRatingProps = {
  /** Stars value 0.5–5 in half steps; null renders empty stars. */
  stars: number | null;
  size?: number;
  /** Show the numeric star value beside the glyphs. */
  showValue?: boolean;
  /** When set, the stars become a half-star selector (left half = ½, right half = full). */
  onChange?: (stars: number) => void;
  className?: string;
};

const STAR_COUNT = STARS_MAX;

/** Five-star glyph row with half-star precision; doubles as the Stars-scale input. */
export function SteamStarRating({ stars, size = 12, showValue = true, onChange, className }: SteamStarRatingProps) {
  const value = stars ?? 0;

  return (
    <View
      className={cn('flex-row items-center gap-1', className)}
      accessibilityRole={onChange ? 'adjustable' : 'image'}
      accessibilityLabel={stars === null ? 'No star rating' : `${stars} out of ${STARS_MAX} stars`}
      accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
      onAccessibilityAction={(e) => {
        if (!onChange) return;
        if (e.nativeEvent.actionName === 'increment') onChange(Math.min(STARS_MAX, value + STARS_STEP));
        if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(STARS_STEP, value - STARS_STEP));
      }}
    >
      <View className="flex-row">
        {Array.from({ length: STAR_COUNT }, (_, i) => {
          const fill = value - i; // ≥1 full, 0.5 half, ≤0 empty
          const icon = fill >= 1 ? 'star' : fill >= 0.5 ? 'star-half-full' : 'star-outline';
          const glyph = (
            <MaterialCommunityIcons name={icon} size={size} color={fill > 0 ? steamColors.highlight : steamColors.accent} />
          );
          if (!onChange) return <View key={i}>{glyph}</View>;
          return (
            <View key={i} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {glyph}
              {/* Two invisible hit areas per star: left = half, right = full. */}
              <View className="absolute inset-0 flex-row">
                <Pressable className="flex-1" hitSlop={{ top: 8, bottom: 8 }} onPress={() => onChange(i + 0.5)} />
                <Pressable className="flex-1" hitSlop={{ top: 8, bottom: 8 }} onPress={() => onChange(i + 1)} />
              </View>
            </View>
          );
        })}
      </View>
      {showValue ? (
        <Text className="font-mono text-steam-xs font-bold text-steam-text-bright">{stars === null ? '--' : `${stars}★`}</Text>
      ) : null}
    </View>
  );
}
