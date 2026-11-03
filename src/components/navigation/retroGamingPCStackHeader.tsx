import type { NativeStackHeaderProps } from 'expo-router';

import { RetroGamingPCHeaderBar } from './RetroGamingPCHeaderBar';

/**
 * `header` renderer for Stack navigators: RetroGamingPC title bar with a back button
 * whenever there is a screen to return to.
 */
export function retroGamingPCStackHeader({ options, route, navigation, back }: NativeStackHeaderProps) {
  return (
    <RetroGamingPCHeaderBar
      title={options.title ?? route.name}
      onBack={back ? () => navigation.goBack() : undefined}
    />
  );
}
