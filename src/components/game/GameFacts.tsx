import { Text, View } from 'react-native';

import { RetroGamingPCPanel } from '@/components/ui';
import type { CompanyRef, IgdbGameDetail } from '@/types/igdb';
import { formatPlaytime, TIME_TO_BEAT_TIERS } from '@/utils/playtime';

import { CompanyLinks } from './CompanyLinks';

/** One row; with `companies`, the names link to their studio pages. */
function FactRow({ label, values, companies }: { label: string; values: string[]; companies?: CompanyRef[] }) {
  if (values.length === 0) return null;
  return (
    <View className="flex-row gap-2 border-b border-b-retrogamingpc-accent py-1">
      <Text className="w-[92px] text-retrogamingpc-xs text-retrogamingpc-text-muted">{label}</Text>
      <Text className="flex-1 text-retrogamingpc-xs text-retrogamingpc-text">
        {companies ? <CompanyLinks companies={companies} fallback={values} /> : values.join(', ')}
      </Text>
    </View>
  );
}

/** Spec-sheet style details table + per-platform release dates. */
export function GameFacts({ game }: { game: IgdbGameDetail }) {
  // One row per platform; IGDB can list several regional dates for the same platform.
  const releases = [...new Map(game.releaseDates.map((r) => [r.platform, r])).values()];
  const ttb = game.timeToBeat ?? null;
  const tiers = ttb ? TIME_TO_BEAT_TIERS.filter((t) => ttb[t.key] !== null) : [];

  return (
    <RetroGamingPCPanel title="Game Details">
      <View>
        <FactRow label="Genre" values={game.genres} />
        <FactRow label="Themes" values={game.themes} />
        <FactRow label="Game modes" values={game.gameModes} />
        <FactRow label="Perspective" values={game.perspectives} />
        <FactRow label="Developer" values={game.developers} companies={game.developerCompanies} />
        <FactRow label="Publisher" values={game.publishers} companies={game.publisherCompanies} />
        <FactRow label="Engine" values={game.engines} />
        <FactRow label="Franchise" values={game.franchises} />
        <FactRow label="Platforms" values={game.platforms} />
      </View>
      {ttb && tiers.length > 0 ? (
        <View className="gap-0.5 pt-2">
          <Text className="retrogamingpc-label pb-1">How long to beat</Text>
          {tiers.map((t) => (
            <View key={t.key} className="flex-row justify-between">
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text">{t.label}</Text>
              <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{formatPlaytime(ttb[t.key]!)}</Text>
            </View>
          ))}
          {ttb.count > 0 ? (
            <Text className="pt-0.5 text-retrogamingpc-xs text-retrogamingpc-text-muted">
              {`Based on ${ttb.count.toLocaleString()} ${ttb.count === 1 ? 'player' : 'players'}`}
            </Text>
          ) : null}
        </View>
      ) : null}
      {releases.length > 0 ? (
        <View className="gap-0.5 pt-2">
          <Text className="retrogamingpc-label pb-1">Release dates</Text>
          {releases.map((r) => (
            <View key={r.platform} className="flex-row justify-between">
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text">{r.platform}</Text>
              <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{r.human}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </RetroGamingPCPanel>
  );
}
