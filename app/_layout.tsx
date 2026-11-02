import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { steamStackHeader } from '@/components/navigation/steamStackHeader';
import { SteamBootScreen } from '@/components/SteamBootScreen';
import { SteamErrorBoundary } from '@/components/SteamErrorBoundary';
import { SteamWindowFrame } from '@/components/SteamWindowFrame';
import { steamColors } from '@/constants/theme';
import { useAuthStore } from '@/hooks/useAuth';
import { queryClient } from '@/services/queryClient';

// Global error boundary. Expo Router has no `+error.tsx` file convention (it
// rejects route files starting with '+'), so the boundary is exported here.
export { SteamErrorBoundary as ErrorBoundary } from '@/components/SteamErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
  // Screen-level boundary keeps the tab bar/sidebar mounted when a screen throws.
  screenErrorBoundary: SteamErrorBoundary,
};

// Keep the native splash up until the stored session has been restored.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => useAuthStore.getState().initialize(), []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-steam-dark" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <SteamWindowFrame>
            <RootNavigator />
          </SteamWindowFrame>
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

/**
 * Route protection:
 *   signed out → only (auth) and auth/callback are reachable; everything else redirects to /login
 *   signed in  → (auth) redirects to / (the Home tab)
 * The navigator is not mounted until the session is known, so guards never act on a
 * transient "signed out" state (which would bounce deep links to /login).
 */
function RootNavigator() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  if (status === 'loading') return <SteamBootScreen />;

  const isSignedIn = status === 'signedIn';

  return (
    <Stack
      screenOptions={{
        header: steamStackHeader,
        // iOS 26 defaults Stack headers to transparent (Liquid Glass); keep ours opaque.
        headerTransparent: false,
        contentStyle: { backgroundColor: steamColors.dark },
      }}
    >
      <Stack.Protected guard={isSignedIn} redirectTo="/login">
        {/* Groups render their own navigator chrome. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
        <Stack.Screen name="user/[id]" options={{ title: 'Player' }} />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn} redirectTo="/">
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>

      {/* Reachable in both states: finishes OAuth / email-link redirects. */}
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
    </Stack>
  );
}
