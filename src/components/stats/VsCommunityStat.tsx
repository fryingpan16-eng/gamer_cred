import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCCard, RetroGamingPCRating } from '@/components/ui';
import { useVsCommunity } from '@/hooks/useStats';
import type { HotTake } from '@/services/stats';
import type { StoredRating } from '@/utils/rating';

import { StatFrame } from './StatFrame';

const asRating = (value: number | null): StoredRating | null => {
  if (value === null) return null;
  const numeric = Math.min(100, Math.max(1, Math.round(value)));
  return { numeric, inputScale: 'numeric', input: String(numeric) };
};

function HotTakeRow({ take }: { take: HotTake }) {
  return (
    <RetroGamingPCCard onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(take.game_id) } })} className="gap-1">
      <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright underline" numberOfLines={1}>
        {take.name}
      </Text>
      <View className="flex-row flex-wrap items-center gap-3">
        <RetroGamingPCRating rating={asRating(take.mine)} size="compact" prefix="You" expanded={false} />
        <RetroGamingPCRating rating={asRating(take.community)} size="compact" prefix="IGDB" expanded={false} />
        <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">
          {take.diff > 0 ? '+' : ''}
          {take.diff}
        </Text>
      </View>
    </RetroGamingPCCard>
  );
}

/** Your average vs IGDB's community rating, and your biggest disagreements. */
export function VsCommunityStat() {
  const query = useVsCommunity(5);
  const v = query.data;

  return (
    <StatFrame
      isPending={query.isPending}
      error={query.error}
      isEmpty={!v || v.compared === 0}
      onRetry={() => void query.refetch()}
      emptyMessage="Rate some games that have an IGDB community score to see this."
    >
      {v ? (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-6">
            <View className="gap-1">
              <Text className="retrogamingpc-label">You</Text>
              <RetroGamingPCRating rating={asRating(v.my_average)} prefix="Avg" />
            </View>
            <View className="gap-1">
              <Text className="retrogamingpc-label">IGDB community</Text>
              <RetroGamingPCRating rating={asRating(v.community_average)} prefix="Avg" />
            </View>
          </View>
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            Compared across {v.compared} game{v.compared === 1 ? '' : 's'} (both on the 1–100 scale).
          </Text>
          <View className="gap-2">
            <Text className="retrogamingpc-heading">Hot takes: you rate higher</Text>
            {v.higher.length === 0 ? <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">None — you never out-rate the crowd.</Text> : null}
            {v.higher.map((t) => (
              <HotTakeRow key={t.game_id} take={t} />
            ))}
          </View>
          <View className="gap-2">
            <Text className="retrogamingpc-heading">Hot takes: you rate lower</Text>
            {v.lower.length === 0 ? <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">None — you never under-rate the crowd.</Text> : null}
            {v.lower.map((t) => (
              <HotTakeRow key={t.game_id} take={t} />
            ))}
          </View>
        </View>
      ) : null}
    </StatFrame>
  );
}
