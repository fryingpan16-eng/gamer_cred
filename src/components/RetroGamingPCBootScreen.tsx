import { Text, View } from 'react-native';

import { RetroGamingPCSpinner } from './ui/RetroGamingPCSpinner';

/** Shown while the stored session is restored (native splash covers this on iOS/Android). */
export function RetroGamingPCBootScreen({ label = 'Connecting to GAMER_CRED network…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-retrogamingpc-dark p-4">
      <View className="retrogamingpc-window w-full max-w-[320px]">
        <View className="retrogamingpc-titlebar">
          <Text className="text-retrogamingpc-sm font-bold tracking-wider text-retrogamingpc-text-bright">GAMER_CRED</Text>
        </View>
        <View className="items-center gap-3 bg-retrogamingpc-card p-4">
          <RetroGamingPCSpinner size="large" />
          <Text className="text-center text-retrogamingpc-sm text-retrogamingpc-text-muted">{label}</Text>
        </View>
      </View>
    </View>
  );
}
