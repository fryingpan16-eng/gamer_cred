import { router, useLocalSearchParams } from 'expo-router';

import { GuestScreen } from '@/components/auth/MembersOnly';
import { StatsPage } from '@/components/stats/StatsPage';
import { useIsGuest } from '@/hooks/useAuth';

/** Stats tab. The selected stat lives in the URL (`/stats?stat=studios`) so it's linkable. */
export default function StatsScreen() {
  const { stat } = useLocalSearchParams<{ stat?: string }>();
  const isGuest = useIsGuest();
  if (isGuest) return <GuestScreen title="Stats" feature="see charts of your own gaming history" />;
  return <StatsPage selectedId={stat} onSelect={(id) => router.setParams({ stat: id })} />;
}
