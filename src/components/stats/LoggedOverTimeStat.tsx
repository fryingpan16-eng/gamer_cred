import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCBarChart, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { useLoggedOverTime } from '@/hooks/useStats';
import { timelineBars, type TimelineGranularity } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const VIEWS: readonly RetroGamingPCTabItem<TimelineGranularity>[] = [
  { key: 'month', label: 'Per month' },
  { key: 'year', label: 'Per year' },
];

/** When you logged games (by when each review was first created). */
export function LoggedOverTimeStat() {
  const [granularity, setGranularity] = useState<TimelineGranularity>('month');
  const query = useLoggedOverTime();
  const bars = timelineBars(query.data ?? [], granularity);
  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={bars.length === 0} onRetry={() => void query.refetch()}>
      <View className="gap-3">
        <RetroGamingPCTabs items={VIEWS} value={granularity} onChange={setGranularity} fill />
        <RetroGamingPCBarChart key={granularity} title={granularity === 'month' ? 'Games logged per month' : 'Games logged per year'} data={bars} orientation="vertical" />
      </View>
    </StatFrame>
  );
}
