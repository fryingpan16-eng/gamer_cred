import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCBarChart, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { useReleaseYearStats } from '@/hooks/useStats';
import { eraBars, type EraGranularity } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const VIEWS: readonly RetroGamingPCTabItem<EraGranularity>[] = [
  { key: 'decade', label: 'By decade' },
  { key: 'year', label: 'By year' },
];

/** Which era of games you play (by release date). */
export function ReleaseEraStat() {
  const [granularity, setGranularity] = useState<EraGranularity>('decade');
  const query = useReleaseYearStats();
  const rows = query.data ?? [];
  const bars = eraBars(rows, granularity);
  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={bars.length === 0} onRetry={() => void query.refetch()}>
      <View className="gap-3">
        <RetroGamingPCTabs items={VIEWS} value={granularity} onChange={setGranularity} fill />
        <RetroGamingPCBarChart key={granularity} title={granularity === 'decade' ? 'Games per decade' : 'Games per release year'} data={bars} orientation="vertical" />
      </View>
    </StatFrame>
  );
}
