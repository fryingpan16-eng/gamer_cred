import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useIsDesktop } from '@/hooks/useIsDesktop';

/**
 * Desktop: centers the app inside a fixed-width, beveled retro client window
 * with a title bar. Mobile: renders children edge-to-edge.
 *
 * Both layouts keep the same tree shape (the title bar slot is just empty on
 * phones), so crossing the breakpoint never remounts the app or loses state.
 */
export function RetroGamingPCWindowFrame({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();

  return (
    <View className={isDesktop ? 'flex-1 items-center bg-retrogamingpc-bevel-dark p-6' : 'flex-1 bg-retrogamingpc-dark'}>
      <View className={isDesktop ? 'retrogamingpc-window flex-1 w-full max-w-retrogamingpc-window' : 'flex-1 w-full'}>
        {isDesktop ? (
          <View className="retrogamingpc-titlebar">
            <Text className="text-retrogamingpc-text-bright text-retrogamingpc-sm font-bold tracking-wider">GAMER_CRED</Text>
          </View>
        ) : null}
        <View className="flex-1">{children}</View>
      </View>
    </View>
  );
}
