import { Text, View } from 'react-native';

import type { ThemePalette } from '@/constants/themes';
import { useThemeColors } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

export type RetroGamingPCAlertTone = 'error' | 'info' | 'success';

export type RetroGamingPCAlertProps = {
  message: string;
  tone?: RetroGamingPCAlertTone;
  className?: string;
};

/** Status tones (theme tokens, darker in the light theme): error red, info blue, success green. */
const TONES: Record<RetroGamingPCAlertTone, { color: keyof ThemePalette; glyph: string }> = {
  error: { color: 'cancelText', glyph: '▲ ' },
  info: { color: 'navigateText', glyph: 'ⓘ ' },
  success: { color: 'saveText', glyph: '✓ ' },
};

/** Inline sunken message box for form-level errors and notices. */
export function RetroGamingPCAlert({ message, tone = 'error', className }: RetroGamingPCAlertProps) {
  const themeColors = useThemeColors();
  const t = { ...TONES[tone], color: themeColors[TONES[tone].color] };
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={cn('border border-l-4 bg-retrogamingpc-dark px-2 py-1.5', className)}
      style={{ borderColor: t.color }}
    >
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        <Text className="font-bold" style={{ color: t.color }}>
          {t.glyph}
        </Text>
        {message}
      </Text>
    </View>
  );
}
