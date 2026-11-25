import { RetroGamingPCBarChart } from '@/components/ui';
import { useGenerationStats } from '@/hooks/useStats';
import { generationAverageBars, generationCountBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

/** How many of your logged games come from each console generation (or PC, arcade, mobile). */
export function GenerationsStat() {
  const query = useGenerationStats();
  const bars = generationCountBars(query.data ?? []);
  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={bars.length === 0} onRetry={() => void query.refetch()}>
      <RetroGamingPCBarChart title="Games per generation" data={bars} orientation="horizontal" unit="games" />
    </StatFrame>
  );
}

/** Your average score (1–100) for each generation's games. */
export function GenerationScoresStat() {
  const query = useGenerationStats();
  const bars = generationAverageBars(query.data ?? []);
  return (
    <StatFrame isPending={query.isPending} error={query.error} isEmpty={bars.length === 0} onRetry={() => void query.refetch()}>
      <RetroGamingPCBarChart title="Average score per generation" data={bars} orientation="horizontal" unit="avg / 100" />
    </StatFrame>
  );
}
