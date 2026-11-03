import { Text, View } from 'react-native';

import { useDeveloperStats, useGenreStats, usePlatformStats, useRatingHistogram, useReleaseYearStats } from '@/hooks/useStats';
import { eraBars, gamerProfileSummary, genreAverageBars, nameCountBars, platformBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

/** A short generated "gamer profile" from the other stats (client-side, no AI). */
export function SummaryStat() {
  const histogram = useRatingHistogram();
  const platforms = usePlatformStats();
  const genres = useGenreStats();
  const years = useReleaseYearStats();
  const studios = useDeveloperStats(1);
  const queries = [histogram, platforms, genres, years, studios];

  const lines = gamerProfileSummary({
    histogram: histogram.data ?? [],
    platforms: platformBars(platforms.data ?? []),
    genres: nameCountBars((genres.data ?? []).map((g) => ({ name: g.genre, games: g.games })), 'g'),
    genreAverages: genreAverageBars(genres.data ?? []),
    decades: eraBars(years.data ?? [], 'decade'),
    studios: nameCountBars(studios.data?.rows ?? [], 'd'),
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
