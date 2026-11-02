import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useIsDesktop } from '@/hooks/useIsDesktop';

/**
 * Desktop: centers the app inside a fixed-width, beveled retro client window
 * with a title bar. Mobile: renders children edge-to-edge.
 */
export function SteamWindowFrame({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return <View className="flex-1 bg-steam-dark">{children}</View>;
  }

  return (
    <View className="flex-1 items-center bg-[#262823] p-6">
      <View className="steam-window flex-1 w-full max-w-steam-window">
        <View className="steam-titlebar">
          <Text className="text-steam-text-bright text-steam-sm font-bold tracking-wider">GAMER_CRED</Text>
          <View className="flex-row gap-1">
            {['_', '□', '✕'].map((glyph) => (
              <View key={glyph} className="steam-bevel bg-steam-button w-4 h-4 items-center justify-center">
                <Text className="text-steam-text text-steam-xs">{glyph}</Text>
              </View>
            ))}
          </View>
        </View>
        <View className="flex-1">{children}</View>
      </View>
    </View>
  );
}
