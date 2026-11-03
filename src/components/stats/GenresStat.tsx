import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCBarChart, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { useGenreStats } from '@/hooks/useStats';
import { genreAverageBars, nameCountBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

type View_ = 'played' | 'average';
const VIEWS: readonly RetroGamingPCTabItem<View_>[] = [
  { key: 'played', label: 'Games played' },
  { key: 'average', label: 'Average rating' },
];

/** Games per genre, or your average (1–100) per genre. */
export function GenresStat() {
  const [view, setView] = useState<View_>('played');
  const query = useGenreStats();
  const rows = query.data ?? [];
  const bars =
    view === 'played'
      ? nameCountBars(rows.map((r) => ({ name: r.genre, games: r.games })), 'g')
      : genreAverageBars(rows);

  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={rows.length === 0} onRetry={() => void query.refetch()}>
      <View className="gap-3">
        <RetroGamingPCTabs items={VIEWS} value={view} onChange={setView} fill />
        <RetroGamingPCBarChart
          key={view}
          title={view === 'played' ? 'Games per genre' : 'Average rating per genre'}
          data={bars}
          orientation="horizontal"
          topN={12}
          showAllToggle
          unit={view === 'played' ? 'games' : 'avg / 100'}
        />
      </View>
    </StatFrame>
  );
}
