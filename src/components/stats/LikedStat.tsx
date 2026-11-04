import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCBarChart, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { useLikedStats } from '@/hooks/useStats';
import type { LikedDimension } from '@/services/stats';
import { nameCountBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const VIEWS: readonly RetroGamingPCTabItem<LikedDimension>[] = [
  { key: 'series', label: 'Series' },
  { key: 'studios', label: 'Studios' },
  { key: 'genres', label: 'Genres' },
  { key: 'era', label: 'Era' },
];

const TOP = 10;

const TITLES: Record<LikedDimension, string> = {
  series: 'Liked games per series',
  studios: 'Liked games per studio',
  genres: 'Liked games per genre',
  era: 'Liked games per decade',
};

/** What you ♥: your liked games by series, studio, genre and release decade. */
export function LikedStat() {
  const [dimension, setDimension] = useState<LikedDimension>('series');
  const [showAll, setShowAll] = useState(false);
  // Eras are few: always fetch them all and show them oldest first.
  const isEra = dimension === 'era';
  const query = useLikedStats(dimension, isEra || showAll ? null : TOP);
  const bars = nameCountBars(query.data?.rows ?? [], dimension);
  const shown = isEra
    ? [...bars].sort((a, b) => (a.label === 'Unknown' ? 1 : b.label === 'Unknown' ? -1 : a.label.localeCompare(b.label)))
    : bars;

  return (
    <StatFrame
      isPending={query.isPending}
      error={query.error}
      isEmpty={shown.length === 0}
      onRetry={() => void query.refetch()}
      emptyMessage="Tap ♥ Like on game pages to see what you like most."
    >
      <View className="gap-3">
        <RetroGamingPCTabs
          items={VIEWS}
          value={dimension}
          onChange={(next) => {
            setDimension(next);
            setShowAll(false);
          }}
          fill
        />
        <RetroGamingPCBarChart
          title={TITLES[dimension]}
          data={shown}
          orientation={isEra ? 'vertical' : 'horizontal'}
          topN={isEra ? undefined : TOP}
          showAllToggle={!isEra}
          showAll={showAll}
          onShowAllChange={setShowAll}
          totalCount={isEra ? undefined : query.data?.total}
          maxHeight={showAll ? 480 : 600}
        />
      </View>
    </StatFrame>
  );
}
