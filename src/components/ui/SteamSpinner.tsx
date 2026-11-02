import { ActivityIndicator, Text, View } from 'react-native';

import { steamColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

export type SteamSpinnerProps = {
  label?: string;
  size?: 'small' | 'large';
  className?: string;
};

/** Loading indicator in Steam olive with an optional retro status line. */
export function SteamSpinner({ label, size = 'small', className }: SteamSpinnerProps) {
  return (
    <View
      className={cn('flex-row items-center gap-2', className)}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ActivityIndicator size={size} color={steamColors.highlight} />
      {label ? <Text className="text-steam-sm text-steam-text-muted">{label}</Text> : null}
    </View>
  );
}
