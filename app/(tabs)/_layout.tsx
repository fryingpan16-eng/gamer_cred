import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';

import { APP_TABS } from '@/components/navigation/appTabs';
import { RetroGamingPCHeaderBar } from '@/components/navigation/RetroGamingPCHeaderBar';
import { RetroGamingPCTabBar } from '@/components/navigation/RetroGamingPCTabBar';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { TermsGate } from '@/components/safety/TermsGate';
import { useApplyPendingRating } from '@/hooks/useRatings';
import { useThemeColors } from '@/hooks/useTheme';


/**
 * 5-tab navigator: permanent left sidebar on desktop; on phones the single bottom
 * nav is drawn by the root layout (RetroGamingPCBottomNav), beneath every page.
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
        // Desktop: the sidebar. Phones: no bar here — the root layout's single
        // RetroGamingPCBottomNav sits beneath every page, tabs included.
        tabBar={(props) => (isDesktop ? <RetroGamingPCTabBar {...props} variant="sidebar" /> : null)}
        screenOptions={{
          tabBarPosition: isDesktop ? 'left' : 'bottom',
          header: ({ options, route }) => <RetroGamingPCHeaderBar title={options.title ?? route.name} />,
          sceneStyle: { backgroundColor: themeColors.dark },
          animation: 'none',
        }}
      >
        {APP_TABS.map((tab) => (
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
