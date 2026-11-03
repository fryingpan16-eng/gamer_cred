import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { retroGamingPCStackHeader } from '@/components/navigation/retroGamingPCStackHeader';
import { RetroGamingPCBootScreen } from '@/components/RetroGamingPCBootScreen';
import { RetroGamingPCErrorBoundary } from '@/components/RetroGamingPCErrorBoundary';
import { RetroGamingPCWindowFrame } from '@/components/RetroGamingPCWindowFrame';
import { RetroGamingPCToastHost } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { queryClient } from '@/services/queryClient';
import { useThemeColors, useThemeStore, useThemeVars } from '@/hooks/useTheme';

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
  useEffect(() => useAuthStore.getState().initialize(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeRoot>
          <SafeAreaView className="flex-1 bg-retrogamingpc-dark" edges={['top', 'left', 'right']}>
            <StatusBar style="light" />
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

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  if (status === 'loading') return <RetroGamingPCBootScreen />;

  const isSignedIn = status === 'signedIn';

  return (
    <Stack
      screenOptions={{
        header: retroGamingPCStackHeader,
        // iOS 26 defaults Stack headers to transparent (Liquid Glass); keep ours opaque.
        headerTransparent: false,
        contentStyle: { backgroundColor: themeColors.dark },
      }}
    >
      <Stack.Protected guard={isSignedIn} redirectTo="/login">
        {/* Groups render their own navigator chrome. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
        <Stack.Screen name="user/[id]" options={{ title: 'Player' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="review/[id]" options={{ title: 'Review' }} />
        <Stack.Screen name="ratings/[userId]" options={{ title: 'Ratings' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn} redirectTo="/">
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Reachable in both states: finishes OAuth / email-link redirects. */}
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
