import { useState } from 'react';

import { RetroGamingPCBarChart } from '@/components/ui';
import { useDeveloperStats } from '@/hooks/useStats';
import { nameCountBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const TOP = 10;

/** Studios you play most: top 10, or the complete list (fetched only when expanded). */
export function StudiosStat() {
  const [showAll, setShowAll] = useState(false);
  const query = useDeveloperStats(showAll ? null : TOP);
  const bars = nameCountBars(query.data?.rows ?? [], 'dev');
  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={bars.length === 0} onRetry={() => void query.refetch()}>
      <RetroGamingPCBarChart
        title="Games per studio"
        data={bars}
        orientation="horizontal"
        topN={TOP}
        showAllToggle
        showAll={showAll}
        onShowAllChange={setShowAll}
        totalCount={query.data?.totalStudios}
        maxHeight={showAll ? 480 : 600}
      />
    </StatFrame>
  );
}
