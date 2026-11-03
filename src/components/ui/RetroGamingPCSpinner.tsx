import { ActivityIndicator, Text, View } from 'react-native';

import { cn } from '@/utils/cn';
import { useThemeColors } from '@/hooks/useTheme';

export type RetroGamingPCSpinnerProps = {
  label?: string;
  size?: 'small' | 'large';
  className?: string;
};

/** Loading indicator in RetroGamingPC olive with an optional retro status line. */
export function RetroGamingPCSpinner({ label, size = 'small', className }: RetroGamingPCSpinnerProps) {
  const themeColors = useThemeColors();
  return (
    <View
      className={cn('flex-row items-center gap-2', className)}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ActivityIndicator size={size} color={themeColors.highlight} />
      {label ? <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">{label}</Text> : null}
    </View>
  );
}
