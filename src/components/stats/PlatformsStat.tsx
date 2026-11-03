import { RetroGamingPCBarChart } from '@/components/ui';
import { usePlatformStats } from '@/hooks/useStats';
import { platformBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

/** Games per "played on" platform (from your reviews). */
export function PlatformsStat() {
  const query = usePlatformStats();
  const bars = platformBars(query.data ?? []);
  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={bars.length === 0} onRetry={() => void query.refetch()}>
      <RetroGamingPCBarChart title="Games per platform" data={bars} orientation="horizontal" topN={10} showAllToggle />
    </StatFrame>
  );
}
