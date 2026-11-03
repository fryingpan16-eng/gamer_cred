import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { platformIcon, platformInfo } from '@/constants/platforms';
import { useThemeColors } from '@/hooks/useTheme';

/** "🎮 Played on PS5" tag for reviews; renders nothing when no platform was chosen. */
export function PlayedOnBadge({ platformId }: { platformId: number | null | undefined }) {
  const themeColors = useThemeColors();
  if (platformId === null || platformId === undefined) return null;
  const info = platformInfo(platformId);
  return (
    <View className="flex-row items-center gap-1 self-start" accessibilityLabel={`Played on ${info.name}`}>
      <MaterialCommunityIcons name={platformIcon(info)} size={11} color={themeColors.textMuted} />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Played on {info.short}</Text>
    </View>
  );
}
