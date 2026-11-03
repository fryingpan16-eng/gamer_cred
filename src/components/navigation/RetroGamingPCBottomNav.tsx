import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { retroGamingPCLayout } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useTheme';

import { APP_TABS, type AppTab } from './appTabs';
import { TabItem } from './RetroGamingPCTabBar';

/** Which tab is showing: `(tabs)/search` → search, `(tabs)` → index; null on pages outside the tabs. */
export function activeTabName(segments: readonly string[]): AppTab['name'] | null {
  if (segments[0] !== '(tabs)') return null;
  const name = segments[1] ?? 'index';
  return APP_TABS.some((t) => t.name === name) ? (name as AppTab['name']) : 'index';
}

/**
 * THE phone navigation bar. Rendered once by the root layout beneath every page
 * (tabs and pushed pages alike), so it is always visible and never covered:
 * pages lay out above it. The tab navigator draws no bar of its own on phones.
 * Desktop uses the sidebar instead (RetroGamingPCTabBar).
 */
export function RetroGamingPCBottomNav() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const active = activeTabName(useSegments());

  return (
    <View
      role="tablist"
      className="flex-row gap-px border-t border-t-retrogamingpc-bevel-light bg-retrogamingpc-panel p-px"
      style={{ height: retroGamingPCLayout.bottomBarHeight + insets.bottom, paddingBottom: insets.bottom }}
    >
      {APP_TABS.map((tab) => (
        <TabItem
          key={tab.name}
          label={tab.title}
          focused={tab.name === active}
          sidebar={false}
          accessibilityLabel={`${tab.title} tab`}
          renderIcon={(color) => <MaterialCommunityIcons name={tab.icon} color={color || themeColors.textMuted} size={20} />}
          // From a pushed page this pops back to the tab; on a tab it switches tabs (each keeps its state).
          onPress={() => {
            if (tab.name !== active) router.navigate(tab.href);
          }}
          onLongPress={() => {}}
        />
      ))}
    </View>
  );
}
