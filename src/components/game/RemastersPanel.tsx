import { Text, View } from 'react-native';

import { RetroGamingPCBadge, RetroGamingPCPanel } from '@/components/ui';
import type { GameRemaster } from '@/types/igdb';

/** "Also remastered in 2018 · PS4, PS5" under the hero's details: says this page is the original. */
export function RemasterNote({ remasters }: { remasters: readonly GameRemaster[] }) {
  if (remasters.length === 0) return null;
  const only = remasters.length === 1 ? remasters[0] : undefined;
  const platforms = only?.platforms ?? [];
  const shown = platforms.slice(0, 3).join(', ') + (platforms.length > 3 ? ` +${platforms.length - 3}` : '');
  return (
    <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
      <Text className="text-retrogamingpc-text-muted">Also remastered: </Text>
      {only
        ? [only.year ? String(only.year) : null, shown || null].filter(Boolean).join(' · ') || only.name
        : `${remasters.length} versions`}
      <Text className="text-retrogamingpc-text-muted"> (see Remastered Versions)</Text>
    </Text>
  );
}

/**
 * The game page's "Remastered Versions" card (only when the game has one). Remasters are
 * not their own entries, so this is information only: name, year and platforms,
 * and a reminder that they're rated and reviewed on this page.
 */
export function RemastersPanel({ remasters }: { remasters: readonly GameRemaster[] }) {
  if (remasters.length === 0) return null;
  return (
    <RetroGamingPCPanel title="Remastered Versions">
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
          This page is the original game. Remasters share it: rate and review them here, and pick the console you played on.
        </Text>
      </View>
    </RetroGamingPCPanel>
  );
}
