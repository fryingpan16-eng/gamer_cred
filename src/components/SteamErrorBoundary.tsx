import type { ErrorBoundaryProps } from 'expo-router';
import { Text, View } from 'react-native';

import { SteamButton } from './ui/SteamButton';

/** Retro Steam "fatal error" dialog used as the Expo Router error boundary. */
export function SteamErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center bg-steam-dark p-4">
      <View className="steam-window w-full max-w-[420px]">
        <View className="steam-titlebar">
          <Text className="text-steam-text-bright text-steam-sm font-bold">Steam — Error</Text>
          <Text className="text-steam-text-muted text-steam-sm">✕</Text>
        </View>
        <View className="bg-steam-card p-4 gap-3">
          <Text className="steam-heading">Something went wrong</Text>
          <View className="steam-bevel-inset bg-steam-dark p-2">
            <Text className="text-steam-text font-mono text-steam-sm" selectable>
              {error.message}
            </Text>
          </View>
          <View className="flex-row justify-end">
            <SteamButton label="Retry" onPress={() => void retry()} />
          </View>
        </View>
      </View>
    </View>
  );
}
