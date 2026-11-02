import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { SteamHeaderBar } from '@/components/navigation/SteamHeaderBar';
import { SteamTabBar } from '@/components/navigation/SteamTabBar';
import { steamColors } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';

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
  const isDesktop = useIsDesktop();

  return (
    <Tabs
      tabBar={(props) => <SteamTabBar {...props} variant={isDesktop ? 'sidebar' : 'bottom'} />}
      screenOptions={{
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        header: ({ options, route }) => <SteamHeaderBar title={options.title ?? route.name} />,
        sceneStyle: { backgroundColor: steamColors.dark },
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
                color={typeof color === 'string' ? color : steamColors.textMuted}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
