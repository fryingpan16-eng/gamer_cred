import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ACTION_COLORS } from '@/constants/actionColors';
import { retroGamingPCLayout } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useToastStore, type ToastTone } from '@/hooks/useToastStore';

/** Same fixed tones as RetroGamingPCAlert: error red, info blue, success green. */
const TONES: Record<ToastTone, { color: string; glyph: string }> = {
  error: { color: ACTION_COLORS.cancel.text, glyph: '!' },
  info: { color: ACTION_COLORS.navigate.text, glyph: 'i' },
  success: { color: ACTION_COLORS.save.text, glyph: '✓' },
};

/** Bottom-anchored retro message boxes. Mounted once in the root layout; tap to dismiss. */
export function RetroGamingPCToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  if (toasts.length === 0) return null;
  // Phones: just above the bottom tab bar and the home indicator. Desktop: near the bottom edge.
  const bottom = isDesktop ? 24 : retroGamingPCLayout.bottomBarHeight + insets.bottom + 8;

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 items-center gap-1 px-4" style={{ bottom }}>
      {toasts.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => dismiss(t.id)}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityHint="Tap to dismiss"
          className="retrogamingpc-bevel w-full max-w-[420px] flex-row items-center gap-2 border-l-4 bg-retrogamingpc-panel px-3 py-2"
          style={{ borderLeftColor: TONES[t.tone].color }}
        >
          <Text className="font-mono text-retrogamingpc-sm font-bold" style={{ color: TONES[t.tone].color }}>
            {TONES[t.tone].glyph}
          </Text>
          <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text-bright">{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}
