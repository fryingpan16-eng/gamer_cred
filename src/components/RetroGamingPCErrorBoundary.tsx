import type { ErrorBoundaryProps } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCButton } from './ui/RetroGamingPCButton';

/** Retro "fatal error" dialog used as the Expo Router error boundary. */
export function RetroGamingPCErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center bg-retrogamingpc-dark p-4">
      <View className="retrogamingpc-window w-full max-w-[420px]">
        <View className="retrogamingpc-titlebar">
          <Text className="text-retrogamingpc-text-bright text-retrogamingpc-sm font-bold">GamerCred — Error</Text>
        </View>
        <View className="bg-retrogamingpc-card p-4 gap-3">
          <Text className="retrogamingpc-heading">Something went wrong</Text>
          <View className="retrogamingpc-bevel-inset bg-retrogamingpc-dark p-2">
            <Text className="text-retrogamingpc-text font-mono text-retrogamingpc-sm" selectable>
              {error.message}
            </Text>
          </View>
          <View className="flex-row justify-end">
            <RetroGamingPCButton label="Retry" onPress={() => void retry()} />
          </View>
        </View>
      </View>
    </View>
  );
}
