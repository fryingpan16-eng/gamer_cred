import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { RetroGamingPCHeaderBar } from '@/components/navigation/RetroGamingPCHeaderBar';
import { RetroGamingPCTabBar } from '@/components/navigation/RetroGamingPCTabBar';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { TermsGate } from '@/components/safety/TermsGate';
import { useApplyPendingRating } from '@/hooks/useRatings';
import { useThemeColors } from '@/hooks/useTheme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: readonly { name: 'index' | 'search' | 'post' | 'stats' | 'profile'; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'search', title: 'Search', icon: 'magnify' },
  { name: 'post', title: 'Now Playing', icon: 'gamepad-variant-outline' },
  { name: 'stats', title: 'Stats', icon: 'chart-bar' },
  { name: 'profile', title: 'Profile', icon: 'account-outline' },
];

/**
 * 5-tab navigator: bottom bar on mobile, permanent left sidebar on desktop.
 * The same navigator instance is kept across breakpoints (only tabBarPosition
 * changes), so crossing the breakpoint never remounts screens or loses state.
 */
export default function TabsLayout() {
  const themeColors = useThemeColors();
  // A star tapped while signed out is applied once the user is in.
  useApplyPendingRating();
  const isDesktop = useIsDesktop();

  return (
    <>
      <Tabs
        tabBar={(props) => <RetroGamingPCTabBar {...props} variant={isDesktop ? 'sidebar' : 'bottom'} />}
        screenOptions={{
          tabBarPosition: isDesktop ? 'left' : 'bottom',
          header: ({ options, route }) => <RetroGamingPCHeaderBar title={options.title ?? route.name} />,
          sceneStyle: { backgroundColor: themeColors.dark },
          animation: 'none',
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons
                  name={tab.icon}
                  color={typeof color === 'string' ? color : themeColors.textMuted}
                  size={size}
                />
              ),
            }}
          />
        ))}
      </Tabs>
      {/* One-time Terms / Community Guidelines acceptance (store requirement). */}
      <TermsGate />
    </>
  );
}
