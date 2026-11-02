import type { NativeStackHeaderProps } from 'expo-router';

import { SteamHeaderBar } from './SteamHeaderBar';

/**
 * `header` renderer for Stack navigators: Steam title bar with a back button
 * whenever there is a screen to return to.
 */
export function steamStackHeader({ options, route, navigation, back }: NativeStackHeaderProps) {
  return (
    <SteamHeaderBar
      title={options.title ?? route.name}
      onBack={back ? () => navigation.goBack() : undefined}
    />
  );
}
