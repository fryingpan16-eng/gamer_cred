import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { steamColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

export type SteamStarRatingProps = {
  /** Score on the app's 0–10 scale (shown as 5 stars, half-star precision). */
  rating: number | null;
  size?: number;
  /** Show the numeric score beside the stars. */
  showValue?: boolean;
  className?: string;
};

/** Read-only 5-star display of a 1–10 score (8/10 → ★★★★☆). */
export function SteamStarRating({ rating, size = 12, showValue = true, className }: SteamStarRatingProps) {
  const halves = rating === null ? 0 : Math.round(Math.max(0, Math.min(10, rating)));

  return (
    <View
      className={cn('flex-row items-center gap-1', className)}
      accessibilityRole="image"
      accessibilityLabel={rating === null ? 'Not rated' : `Rated ${rating} out of 10`}
    >
      <View className="flex-row">
        {[0, 1, 2, 3, 4].map((i) => {
          const value = halves - i * 2;
          const icon = value >= 2 ? 'star' : value === 1 ? 'star-half-full' : 'star-outline';
          return (
            <MaterialCommunityIcons
              key={i}
              name={icon}
              size={size}
              color={value > 0 ? steamColors.highlight : steamColors.accent}
            />
          );
        })}
      </View>
      {showValue ? (
        <Text className="font-mono text-steam-xs font-bold text-steam-text-bright">
          {rating === null ? '--' : Number.isInteger(rating) ? rating : rating.toFixed(1)}/10
        </Text>
      ) : null}
    </View>
  );
}
