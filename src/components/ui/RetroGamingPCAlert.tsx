import { Text, View } from 'react-native';

import { ACTION_COLORS } from '@/constants/actionColors';
import { cn } from '@/utils/cn';

export type RetroGamingPCAlertTone = 'error' | 'info' | 'success';

export type RetroGamingPCAlertProps = {
  message: string;
  tone?: RetroGamingPCAlertTone;
  className?: string;
};

/** Fixed in every theme: error red, info blue, success green. */
const TONES: Record<RetroGamingPCAlertTone, { color: string; glyph: string }> = {
  error: { color: ACTION_COLORS.cancel.text, glyph: '▲ ' },
  info: { color: ACTION_COLORS.navigate.text, glyph: 'ⓘ ' },
  success: { color: ACTION_COLORS.save.text, glyph: '✓ ' },
};

/** Inline sunken message box for form-level errors and notices. */
export function RetroGamingPCAlert({ message, tone = 'error', className }: RetroGamingPCAlertProps) {
  const t = TONES[tone];
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
