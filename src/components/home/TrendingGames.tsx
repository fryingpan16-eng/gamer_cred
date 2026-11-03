import { router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CoverTile } from '@/components/profile/CoverTile';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { useTrendingGames } from '@/hooks/useFeed';
import { useGameLookup } from '@/hooks/useGames';
import { TRENDING_DAYS } from '@/services/feed';

/** Games the most players rated or reviewed in the last two weeks. */
export function TrendingGames() {
  const trending = useTrendingGames();
  const rows = trending.data ?? [];
  const games = useGameLookup(rows.map((r) => r.gameId));

  return (
    <RetroGamingPCPanel title="Trending Games">
      {trending.isPending ? (
        <RetroGamingPCSpinner label="Loading trending games…" />
      ) : trending.isError ? (
        <RetroGamingPCAlert message={trending.error.message} />
      ) : rows.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          Nothing trending yet. Games rated or reviewed in the last {TRENDING_DAYS} days show up here.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {rows.map((r, i) => {
            const game = games.data?.get(r.gameId);
            const avg = r.averageRating === null ? null : Math.min(100, Math.max(1, Math.round(r.averageRating)));
            return (
              <Pressable
                key={r.gameId}
                accessibilityRole="link"
                accessibilityLabel={`#${i + 1} trending: ${game?.name ?? 'game'}, ${r.players} player${r.players === 1 ? '' : 's'}. Open game page`}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(r.gameId) } })}
                className="w-[104px] gap-1"
              >
                <View>
                  <CoverTile game={game} gameId={r.gameId} loading={games.isFetching} />
                  <View className="absolute left-0 top-0 bg-retrogamingpc-dark px-1">
                    <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">#{i + 1}</Text>
                  </View>
                </View>
                <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
                  {game?.name ?? '…'}
                </Text>
                <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
                  {r.players} player{r.players === 1 ? '' : 's'}
                </Text>
                {avg !== null ? (
                  <View pointerEvents="none">
                    <RetroGamingPCRating rating={{ numeric: avg, inputScale: 'numeric', input: String(avg) }} size="compact" expanded={false} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </RetroGamingPCPanel>
  );
}
