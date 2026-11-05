import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { formatFinishedOn } from '@/components/game/ReplayButton';
import { RetroGamingPCBarChart, RetroGamingPCCard, RetroGamingPCRating } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useReplayStats } from '@/hooks/useStats';
import type { StoredRating } from '@/utils/rating';
import { replayYearBars } from '@/utils/stats';

import { StatFrame } from './StatFrame';

const asRating = (numeric: number): StoredRating => ({ numeric, inputScale: 'numeric', input: String(numeric) });

/** Your replays (migration 000040): totals, most replayed games, replays per year and how your scores moved. */
export function ReplaysStat() {
  const query = useReplayStats(10);
  const r = query.data;
  const ids = [...new Set([...(r?.top ?? []).map((t) => t.gameId), ...(r?.scoreChanges ?? []).map((c) => c.gameId)])];
  const games = useGameLookup(ids);
  const nameOf = (id: number) => games.data?.get(id)?.name ?? `Game #${id}`;
  const open = (id: number) => router.push({ pathname: '/game/[id]', params: { id: String(id) } });

  return (
    <StatFrame
      isPending={query.isPending}
      error={query.error}
      isEmpty={!r || (r.total === 0 && r.scoreChanges.length === 0)}
      onRetry={() => void query.refetch()}
      emptyMessage="Mark a game as replayed on its page, or write a replay review in the Review Studio, to see this."
    >
      {r ? (
        <View className="gap-4">
          <View className="flex-row flex-wrap gap-6">
            <View className="gap-0.5">
              <Text className="retrogamingpc-label">Replays</Text>
              <Text className="font-mono text-retrogamingpc-xl font-bold text-retrogamingpc-text-bright">{r.total}</Text>
            </View>
            <View className="gap-0.5">
              <Text className="retrogamingpc-label">Games replayed</Text>
              <Text className="font-mono text-retrogamingpc-xl font-bold text-retrogamingpc-text-bright">{r.games}</Text>
            </View>
          </View>

          {r.top.length > 0 ? (
            <View className="gap-2">
              <Text className="retrogamingpc-heading">Most replayed</Text>
              {r.top.map((t, i) => (
                <RetroGamingPCCard key={t.gameId} onPress={() => open(t.gameId)} className="flex-row items-center gap-3">
                  <Text className="w-6 font-mono text-retrogamingpc-sm text-retrogamingpc-text-muted">{i + 1}.</Text>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright underline" numberOfLines={1}>
                      {nameOf(t.gameId)}
                    </Text>
                    {t.lastFinished ? (
                      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Last finished {formatFinishedOn(t.lastFinished)}</Text>
                    ) : null}
                  </View>
                  <Text className="font-mono text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright">
                    {t.replays + 1} plays
                  </Text>
                </RetroGamingPCCard>
              ))}
            </View>
          ) : null}

          {r.byYear.length > 0 ? (
            <RetroGamingPCBarChart title="Replays per year finished" data={replayYearBars(r.byYear)} orientation="vertical" />
          ) : null}

          {r.scoreChanges.length > 0 ? (
            <View className="gap-2">
              <Text className="retrogamingpc-heading">Changed your mind</Text>
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Your first review’s score against your newest, for games you’ve reviewed more than once.</Text>
              {r.scoreChanges.map((c) => {
                const diff = c.latest - c.first;
                return (
                  <RetroGamingPCCard key={c.gameId} onPress={() => open(c.gameId)} className="gap-1">
                    <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright underline" numberOfLines={1}>
                      {nameOf(c.gameId)}
                    </Text>
                    <View className="flex-row flex-wrap items-center gap-3">
                      <RetroGamingPCRating rating={asRating(c.first)} size="compact" prefix="First" expanded={false} />
                      <RetroGamingPCRating rating={asRating(c.latest)} size="compact" prefix="Now" expanded={false} />
                      <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">
                        {diff > 0 ? '+' : ''}
                        {diff} · {c.reviews} reviews
                      </Text>
                    </View>
                  </RetroGamingPCCard>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
    </StatFrame>
  );
}
