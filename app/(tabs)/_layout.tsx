import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { RetroGamingPCHeaderBar } from '@/components/navigation/RetroGamingPCHeaderBar';
import { RetroGamingPCTabBar } from '@/components/navigation/RetroGamingPCTabBar';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useThemeColors } from '@/hooks/useTheme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: readonly { name: 'index' | 'search' | 'post' | 'profile'; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'search', title: 'Search', icon: 'magnify' },
  { name: 'post', title: 'Review Studio', icon: 'pencil-box-outline' },
  { name: 'profile', title: 'Profile', icon: 'account-outline' },
];

/**
 * 4-tab navigator: bottom bar on mobile, permanent left sidebar on desktop.
 * The same navigator instance is kept across breakpoints (only tabBarPosition
 * changes), so crossing the breakpoint never remounts screens or loses state.
 */
export default function TabsLayout() {
  const themeColors = useThemeColors();
  const isDesktop = useIsDesktop();

  return (
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
  );
}
