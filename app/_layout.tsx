import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RetroGamingPCBottomNav } from '@/components/navigation/RetroGamingPCBottomNav';
import { retroGamingPCStackHeader } from '@/components/navigation/retroGamingPCStackHeader';
import { RetroGamingPCBootScreen } from '@/components/RetroGamingPCBootScreen';
import { RetroGamingPCErrorBoundary } from '@/components/RetroGamingPCErrorBoundary';
import { RetroGamingPCWindowFrame } from '@/components/RetroGamingPCWindowFrame';
import { RetroGamingPCToastHost } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { restoreGameRecords, startSavingGameRecords } from '@/services/gameRecordStore';
import { queryClient } from '@/services/queryClient';
import { useIsLightTheme, useThemeColors, useThemeStore, useThemeVars } from '@/hooks/useTheme';

// Global error boundary. Expo Router has no `+error.tsx` file convention (it
// rejects route files starting with '+'), so the boundary is exported here.
export { RetroGamingPCErrorBoundary as ErrorBoundary } from '@/components/RetroGamingPCErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
  // Screen-level boundary keeps the tab bar/sidebar mounted when a screen throws.
  screenErrorBoundary: RetroGamingPCErrorBoundary,
};

// Keep the native splash up until the stored session has been restored.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const isLight = useIsLightTheme();
  useEffect(() => useAuthStore.getState().initialize(), []);
  // Game records saved on this device: covers show at once on launch (public IGDB data only).
  useEffect(() => {
    void restoreGameRecords(queryClient);
    return startSavingGameRecords(queryClient);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeRoot>
          <SafeAreaView className="flex-1 bg-retrogamingpc-dark" edges={['top', 'left', 'right']}>
            <StatusBar style={isLight ? 'dark' : 'light'} />
            <RetroGamingPCWindowFrame>
              <RootNavigator />
            </RetroGamingPCWindowFrame>
            <RetroGamingPCToastHost />
          </SafeAreaView>
        </ThemeRoot>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Applies the active colour theme (CSS variables) to the whole tree.
 * Source of truth: the signed-in profile's `ui_theme`; before sign-in or while
 * the profile loads, the device-cached choice is used so screens don't flash the default theme.
 */
function ThemeRoot({ children }: { children: ReactNode }) {
  const themeVars = useThemeVars();
  const profileTheme = useAuthStore((s) => s.profile?.ui_theme);

  useEffect(() => {
    void useThemeStore.getState().hydrate(() => useAuthStore.getState().profile?.ui_theme === undefined);
  }, []);

  useEffect(() => {
    if (profileTheme) useThemeStore.getState().setTheme(profileTheme);
  }, [profileTheme]);

  return <View style={[{ flex: 1 }, themeVars]}>{children}</View>;
}

/**
 * Route protection:
 *   signed out → only (auth) and auth/callback are reachable; everything else redirects to /login
 *   signed in  → (auth) redirects to / (the Home tab)
 * The navigator is not mounted until the session is known, so guards never act on a
 * transient "signed out" state (which would bounce deep links to /login).
 */
function RootNavigator() {
  const themeColors = useThemeColors();
  const status = useAuthStore((s) => s.status);
  // The root SafeAreaView skips the bottom edge (the tab bar pads itself), so
  // full-screen pages keep their last row clear of the home indicator here.
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  if (status === 'loading') return <RetroGamingPCBootScreen />;

  const isSignedIn = status === 'signedIn';
  // Phones: ONE bottom nav bar, beneath every signed-in page (tabs and pushed pages).
  // Pages lay out above it, so nothing ever covers it.
  const showBottomNav = isSignedIn && !isDesktop;

  return (
    <View className="flex-1">
      <Stack
        screenOptions={{
          header: retroGamingPCStackHeader,
          // iOS 26 defaults Stack headers to transparent (Liquid Glass); keep ours opaque.
          headerTransparent: false,
          // The bottom nav pads the home indicator itself; otherwise the page does.
          contentStyle: {
            backgroundColor: themeColors.dark,
            paddingBottom: showBottomNav ? 0 : insets.bottom,
          },
        }}
      >
        <Stack.Protected guard={isSignedIn} redirectTo="/login">
          {/* Groups render their own navigator chrome. */}
          <Stack.Screen
            name="(tabs)"
            options={{
              headerShown: false,
              contentStyle: { backgroundColor: themeColors.dark },
            }}
          />
          <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
          <Stack.Screen name="user/[id]" options={{ title: 'Player' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="review/[id]" options={{ title: 'Review' }} />
          <Stack.Screen name="reviews/[gameId]" options={{ title: 'Reviews' }} />
          <Stack.Screen name="ratings/[userId]" options={{ title: 'Ratings' }} />
          <Stack.Screen name="list/[id]" options={{ title: 'List' }} />
          <Stack.Screen name="studio/[id]" options={{ title: 'Studio' }} />
          <Stack.Screen name="friends/[userId]" options={{ title: 'Friends' }} />
          <Stack.Screen name="likes/[userId]" options={{ title: 'Liked Games' }} />
          <Stack.Screen name="backlog/[userId]" options={{ title: 'Backlog' }} />
          {/* Titled by the screen itself once access is known (non-admins see "Not found"). */}
          <Stack.Screen name="admin/reports" options={{ title: '' }} />
        </Stack.Protected>

        <Stack.Protected guard={!isSignedIn} redirectTo="/">
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        {/* Reachable in both states: finishes OAuth / email-link redirects. */}
        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        {/* Public in both states: linked from sign-up, Settings and the store listings. */}
        <Stack.Screen name="terms" options={{ title: 'Terms & Community Guidelines' }} />
        <Stack.Screen name="delete-account" options={{ title: 'Delete your account' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="licenses" options={{ title: 'Open-source licenses' }} />
      </Stack>
      {showBottomNav ? <RetroGamingPCBottomNav /> : null}
    </View>
  );
}
