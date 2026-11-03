import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { retroGamingPCLayout } from '@/constants/theme';
import { useThemeColors } from '@/hooks/useTheme';

import { APP_TABS } from './appTabs';
import { TabItem } from './RetroGamingPCTabBar';

/**
 * Phones: the bottom tab bar on pages outside the tab navigator (game, player,
 * list, studio, settings…), so it is visible and usable everywhere. Looks and
 * sizes exactly like the tab navigator's own bar. Tapping a tab returns to it
 * (popping the open pages), like a native tab bar.
 */
export function RetroGamingPCGlobalTabBar() {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
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
          focused={false}
          sidebar={false}
          accessibilityLabel={`${tab.title} tab`}
          renderIcon={(color) => <MaterialCommunityIcons name={tab.icon} color={color || themeColors.textMuted} size={20} />}
          onPress={() => router.navigate(tab.href)}
          onLongPress={() => {}}
        />
      ))}
    </View>
  );
}
