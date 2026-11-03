import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useIsDesktop } from '@/hooks/useIsDesktop';

/**
 * Desktop: centers the app inside a fixed-width, beveled retro client window
 * with a title bar. Mobile: renders children edge-to-edge.
 */
export function RetroGamingPCWindowFrame({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return <View className="flex-1 bg-retrogamingpc-dark">{children}</View>;
  }

  return (
    <View className="flex-1 items-center bg-retrogamingpc-bevel-dark p-6">
      <View className="retrogamingpc-window flex-1 w-full max-w-retrogamingpc-window">
        <View className="retrogamingpc-titlebar">
          <Text className="text-retrogamingpc-text-bright text-retrogamingpc-sm font-bold tracking-wider">GAMER_CRED</Text>
        </View>
        <View className="flex-1">{children}</View>
      </View>
    </View>
  );
}
