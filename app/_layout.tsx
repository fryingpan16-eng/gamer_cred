import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { steamStackHeader } from '@/components/navigation/steamStackHeader';
import { SteamErrorBoundary } from '@/components/SteamErrorBoundary';
import { SteamWindowFrame } from '@/components/SteamWindowFrame';
import { steamColors } from '@/constants/theme';
import { queryClient } from '@/services/queryClient';

// Global error boundary. Expo Router has no `+error.tsx` file convention (it
// rejects route files starting with '+'), so the boundary is exported here.
export { SteamErrorBoundary as ErrorBoundary } from '@/components/SteamErrorBoundary';

export const unstable_settings = {
  anchor: '(tabs)',
  // Screen-level boundary keeps the tab bar/sidebar mounted when a screen throws.
  screenErrorBoundary: SteamErrorBoundary,
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SafeAreaView className="flex-1 bg-steam-dark" edges={['top', 'left', 'right']}>
          <StatusBar style="light" />
          <SteamWindowFrame>
            <Stack
              screenOptions={{
                header: steamStackHeader,
                // iOS 26 defaults Stack headers to transparent (Liquid Glass); keep ours opaque.
                headerTransparent: false,
                contentStyle: { backgroundColor: steamColors.dark },
              }}
            >
              {/* Groups render their own navigator chrome. */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="game/[id]" options={{ title: 'Game' }} />
              <Stack.Screen name="user/[id]" options={{ title: 'Player' }} />
            </Stack>
          </SteamWindowFrame>
        </SafeAreaView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
