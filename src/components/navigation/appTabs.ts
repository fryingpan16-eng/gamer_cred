import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** The five main tabs, shared by the tab navigator and the always-visible phone bar. */
export const APP_TABS = [
  { name: 'index', href: '/', title: 'Home', icon: 'home-outline' },
  { name: 'search', href: '/search', title: 'Search', icon: 'magnify' },
  { name: 'post', href: '/post', title: 'Now Playing', icon: 'gamepad-variant-outline' },
  { name: 'stats', href: '/stats', title: 'Stats', icon: 'chart-bar' },
  { name: 'profile', href: '/profile', title: 'Profile', icon: 'account-outline' },
] as const satisfies readonly { name: string; href: string; title: string; icon: IconName }[];

export type AppTab = (typeof APP_TABS)[number];
