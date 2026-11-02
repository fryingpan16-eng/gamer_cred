import { Text, View } from 'react-native';

import { SteamPanel } from '@/components/ui';
import type { IgdbGameDetail } from '@/types/igdb';

function FactRow({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <View className="flex-row gap-2 border-b border-b-steam-accent py-1">
      <Text className="w-[92px] text-steam-xs text-steam-text-muted">{label}</Text>
      <Text className="flex-1 text-steam-xs text-steam-text">{values.join(', ')}</Text>
    </View>
  );
}

/** Spec-sheet style details table + per-platform release dates. */
export function GameFacts({ game }: { game: IgdbGameDetail }) {
  // One row per platform; IGDB can list several regional dates for the same platform.
  const releases = [...new Map(game.releaseDates.map((r) => [r.platform, r])).values()];

  return (
    <SteamPanel title="Game Details">
      <View>
        <FactRow label="Genre" values={game.genres} />
        <FactRow label="Themes" values={game.themes} />
        <FactRow label="Game modes" values={game.gameModes} />
        <FactRow label="Perspective" values={game.perspectives} />
        <FactRow label="Developer" values={game.developers} />
        <FactRow label="Publisher" values={game.publishers} />
        <FactRow label="Engine" values={game.engines} />
        <FactRow label="Franchise" values={game.franchises} />
        <FactRow label="Platforms" values={game.platforms} />
      </View>
      {releases.length > 0 ? (
        <View className="gap-0.5 pt-2">
          <Text className="steam-label pb-1">Release dates</Text>
          {releases.map((r) => (
            <View key={r.platform} className="flex-row justify-between">
              <Text className="text-steam-xs text-steam-text">{r.platform}</Text>
              <Text className="font-mono text-steam-xs text-steam-text-muted">{r.human}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </SteamPanel>
  );
}
