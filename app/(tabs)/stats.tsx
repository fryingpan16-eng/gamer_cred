import { router, useLocalSearchParams } from 'expo-router';

import { StatsPage } from '@/components/stats/StatsPage';

/** Stats tab. The selected stat lives in the URL (`/stats?stat=studios`) so it's linkable. */
export default function StatsScreen() {
  const { stat } = useLocalSearchParams<{ stat?: string }>();
  return <StatsPage selectedId={stat} onSelect={(id) => router.setParams({ stat: id })} />;
}
