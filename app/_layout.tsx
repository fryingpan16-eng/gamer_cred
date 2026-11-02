import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { SteamErrorBoundary } from '@/components/SteamErrorBoundary';
import { SteamWindowFrame } from '@/components/SteamWindowFrame';
import { queryClient } from '@/services/queryClient';

// Global error boundary. Expo Router has no `+error.tsx` file convention (it
// rejects route files starting with '+'), so the boundary is exported here.
export { SteamErrorBoundary as ErrorBoundary } from '@/components/SteamErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
  // Screen-level boundary keeps the tab bar/sidebar mounted when a screen throws.
  screenErrorBoundary: SteamErrorBoundary,
};

const STEAM_DARK = '#3a3d36';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-steam-dark" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <SteamWindowFrame>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: STEAM_DARK },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="game/[id]" />
              <Stack.Screen name="user/[id]" />
            </Stack>
          </SteamWindowFrame>
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
