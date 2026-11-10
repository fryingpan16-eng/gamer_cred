import { View } from 'react-native';

import { RetroGamingPCCard } from '@/components/ui';

/** Grey stand-ins shaped like ReviewCards while reviews load (static: no animation). */
export function ReviewCardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View className="gap-2" accessible accessibilityLabel="Loading reviews…" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <RetroGamingPCCard key={i} className="gap-2 opacity-60">
          <View className="flex-row gap-3">
            <View className="retrogamingpc-bevel-inset h-10 w-10 bg-retrogamingpc-dark" />
            <View className="flex-1 gap-2 py-1">
              <View className="h-3 w-1/2 bg-retrogamingpc-panel" />
              <View className="h-2 w-1/4 bg-retrogamingpc-panel" />
            </View>
          </View>
          <View className="h-2 w-full bg-retrogamingpc-panel" />
          <View className="h-2 w-5/6 bg-retrogamingpc-panel" />
          <View className="h-2 w-2/3 bg-retrogamingpc-panel" />
        </RetroGamingPCCard>
      ))}
    </View>
  );
}
