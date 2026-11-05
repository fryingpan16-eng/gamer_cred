import { Text, View } from 'react-native';

import { useGameLookup } from '@/hooks/useGames';
import { useDeveloperStats, useGenreStats, usePlatformStats, useRatingHistogram, useReleaseYearStats, useReplayStats } from '@/hooks/useStats';
import { eraBars, gamerProfileSummary, genreAverageBars, nameCountBars, platformBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

/** A short generated "gamer profile" from the other stats (client-side, no AI). */
export function SummaryStat() {
  const histogram = useRatingHistogram();
  const platforms = usePlatformStats();
  const genres = useGenreStats();
  const years = useReleaseYearStats();
  const studios = useDeveloperStats(1);
  const replays = useReplayStats(10);
  const topReplay = replays.data?.top[0] ?? null;
  const replayGame = useGameLookup(topReplay ? [topReplay.gameId] : []);
  const queries = [histogram, platforms, genres, years, studios, replays];

  const lines = gamerProfileSummary({
    histogram: histogram.data ?? [],
    platforms: platformBars(platforms.data ?? []),
    genres: nameCountBars((genres.data ?? []).map((g) => ({ name: g.genre, games: g.games })), 'g'),
    genreAverages: genreAverageBars(genres.data ?? []),
    decades: eraBars(years.data ?? [], 'decade'),
    studios: nameCountBars(studios.data?.rows ?? [], 'd'),
    mostReplayed: topReplay
      ? { name: replayGame.data?.get(topReplay.gameId)?.name ?? `Game #${topReplay.gameId}`, plays: topReplay.replays + 1 }
      : null,
  });

  return (
    <StatFrame
      isPending={queries.some((q) => q.isPending)}
      error={queries.find((q) => q.error)?.error ?? null}
      isEmpty={lines.length === 0}
      onRetry={() => queries.forEach((q) => void q.refetch())}
    >
      <View className="retrogamingpc-bevel-inset gap-2 bg-retrogamingpc-dark p-3">
        <Text className="retrogamingpc-label">Your gamer profile</Text>
        {lines.map((line) => (
          <Text key={line} className="text-retrogamingpc-sm leading-[18px] text-retrogamingpc-text">
            ▸ {line}
          </Text>
        ))}
      </View>
    </StatFrame>
  );
}
