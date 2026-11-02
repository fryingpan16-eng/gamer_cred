import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useIsDesktop } from '@/hooks/useIsDesktop';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const TABS: readonly { name: 'index' | 'search' | 'post' | 'profile'; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline' },
  { name: 'search', title: 'Search', icon: 'magnify' },
  { name: 'post', title: 'Review Studio', icon: 'pencil-box-outline' },
  { name: 'profile', title: 'Profile', icon: 'account-outline' },
];

const C = {
  dark: '#3a3d36',
  card: '#4c5046',
  panel: '#595e52',
  accent: '#6a725e',
  highlight: '#9da789',
  textBright: '#e6ebd6',
  textMuted: '#889177',
} as const;

/** 4-tab navigator: bottom bar on mobile, permanent left sidebar on desktop. */
export default function TabsLayout() {
  const isDesktop = useIsDesktop();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarVariant: isDesktop ? 'material' : 'uikit',
        tabBarLabelPosition: isDesktop ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: C.textBright,
        tabBarInactiveTintColor: C.textMuted,
        tabBarActiveBackgroundColor: C.accent,
        tabBarStyle: {
          backgroundColor: C.panel,
          borderTopColor: C.highlight,
          borderRightColor: '#262823',
          borderRightWidth: isDesktop ? 1 : 0,
          minWidth: isDesktop ? 180 : undefined,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: C.dark },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name={tab.icon} color={typeof color === 'string' ? color : C.textMuted} size={isDesktop ? 18 : size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
