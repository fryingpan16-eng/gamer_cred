import { Text, View } from 'react-native';

import { SteamSpinner } from './ui/SteamSpinner';

/** Shown while the stored session is restored (native splash covers this on iOS/Android). */
export function SteamBootScreen({ label = 'Connecting to GAMER_CRED network…' }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-steam-dark p-4">
      <View className="steam-window w-full max-w-[320px]">
        <View className="steam-titlebar">
          <Text className="text-steam-sm font-bold tracking-wider text-steam-text-bright">GAMER_CRED</Text>
        </View>
        <View className="items-center gap-3 bg-steam-card p-4">
          <SteamSpinner size="large" />
          <Text className="text-center text-steam-sm text-steam-text-muted">{label}</Text>
        </View>
      </View>
    </View>
  );
}
