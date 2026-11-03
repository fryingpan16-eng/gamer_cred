import { Pressable, Text, View } from 'react-native';

import { useToastStore } from '@/hooks/useToastStore';
import { cn } from '@/utils/cn';

/** Bottom-anchored retro message boxes. Mounted once in the root layout; tap to dismiss. */
export function RetroGamingPCToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  if (toasts.length === 0) return null;

  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-20 items-center gap-1 px-4 md:bottom-6">
      {toasts.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => dismiss(t.id)}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          accessibilityHint="Tap to dismiss"
          className={cn(
            'retrogamingpc-bevel w-full max-w-[420px] flex-row items-center gap-2 bg-retrogamingpc-panel px-3 py-2',
            t.tone === 'error' ? 'border-l-4 border-l-retrogamingpc-error' : 'border-l-4 border-l-retrogamingpc-highlight',
          )}
        >
          <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">{t.tone === 'error' ? '!' : 'i'}</Text>
          <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text-bright">{t.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}
