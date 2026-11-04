import { Text, View } from 'react-native';

import { RetroGamingPCBadge, RetroGamingPCPanel } from '@/components/ui';
import type { GameRemaster } from '@/types/igdb';

/**
 * The game page's "Remastered" card (only when the game has one). Remasters are
 * not their own entries, so this is information only: name, year and platforms,
 * and a reminder that they're rated and reviewed on this page.
 */
export function RemastersPanel({ remasters }: { remasters: readonly GameRemaster[] }) {
  if (remasters.length === 0) return null;
  return (
    <RetroGamingPCPanel title="Remastered">
      <View className="gap-2">
        {remasters.map((r) => (
          <View key={r.id} className="gap-1">
            <Text className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright">
              {r.name}
              {r.year ? <Text className="font-normal text-retrogamingpc-text-muted"> ({r.year})</Text> : null}
            </Text>
            {r.platforms.length > 0 ? (
              <View className="flex-row flex-wrap gap-1">
                {r.platforms.map((p) => (
                  <RetroGamingPCBadge key={p} label={p} />
                ))}
              </View>
            ) : null}
          </View>
        ))}
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          Remasters share this page: rate and review them here, and pick the console you played on.
        </Text>
      </View>
    </RetroGamingPCPanel>
  );
}
