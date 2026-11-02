import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { CommunityReviews } from '@/components/game/CommunityReviews';
import { GameActions } from '@/components/game/GameActions';
import { GameFacts } from '@/components/game/GameFacts';
import { GameHero } from '@/components/game/GameHero';
import { ScreenshotStrip } from '@/components/game/ScreenshotStrip';
import { SystemRequirementsPanel } from '@/components/game/SystemRequirementsPanel';
import { SteamAlert, SteamButton, SteamPanel, SteamSpinner } from '@/components/ui';
import { useGameDetail, useGameReviewStats } from '@/hooks/useGameDetail';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { SearchServiceError } from '@/services/igdb';
import type { IgdbGameResult } from '@/types/igdb';
import { queryKeys } from '@/utils/queryKeys';

const PC_PLATFORMS = new Set(['PC', 'Mac', 'Linux']);

function About({ summary, storyline }: { summary: string | null; storyline: string | null }) {
  const [showStory, setShowStory] = useState(false);
  if (!summary && !storyline) return null;
  return (
    <SteamPanel title="About This Game">
      <View className="gap-2">
        {summary ? <Text className="text-steam-sm leading-[18px] text-steam-text">{summary}</Text> : null}
        {storyline ? (
          showStory ? (
            <>
              <Text className="steam-label">Storyline</Text>
              <Text className="text-steam-sm leading-[18px] text-steam-text">{storyline}</Text>
            </>
          ) : (
            <Text onPress={() => setShowStory(true)} className="text-steam-xs text-steam-highlight underline">
              Read the storyline
            </Text>
          )
        ) : null}
      </View>
    </SteamPanel>
  );
}

/**
 * 2004 Steam store-style game page.
 * Desktop: main column (hero, about, media, reviews) + sidebar (actions, facts, requirements).
 */
export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const valid = Number.isSafeInteger(gameId) && gameId > 0;

  const queryClient = useQueryClient();
  const isDesktop = useIsDesktop();
  const detail = useGameDetail(valid ? gameId : null);
  const stats = useGameReviewStats(valid ? gameId : null);
  // Light record from search / slots: instant title while the full page loads.
  const light = valid ? queryClient.getQueryData<IgdbGameResult>(queryKeys.games.detail(gameId)) : undefined;
  const game = detail.data?.game;
  const title = game?.name ?? light?.name ?? `Game #${id}`;

  if (!valid || (detail.isError && detail.error instanceof SearchServiceError && detail.error.status === 404)) {
    return (
      <View className="flex-1 bg-steam-dark p-3">
        <Stack.Screen options={{ title: 'Game not found' }} />
        <SteamPanel title="Game not found">
          <SteamAlert message="This game isn't in the IGDB catalogue (it may have been merged or removed)." />
        </SteamPanel>
      </View>
    );
  }

  if (!game) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-steam-dark p-4">
        <Stack.Screen options={{ title }} />
        {detail.isError ? (
          <SteamPanel title="Couldn't load this game" className="w-full max-w-[420px]">
            <View className="gap-2">
              <SteamAlert message={detail.error.message} />
              <View className="flex-row justify-end">
                <SteamButton label="Retry" onPress={() => void detail.refetch()} />
              </View>
            </View>
          </SteamPanel>
        ) : (
          <SteamSpinner size="large" label={`Loading ${light?.name ?? 'game'}…`} />
        )}
      </View>
    );
  }

  const hasPc = game.platforms.some((p) => PC_PLATFORMS.has(p));

  return (
    <ScrollView className="flex-1 bg-steam-dark" contentContainerClassName="gap-3 p-3">
      <Stack.Screen options={{ title }} />
      <GameHero game={game} stats={stats.data} />
      <View className="gap-3 md:flex-row md:items-start">
        <View className="gap-3 md:flex-[3]">
          {/* On phones the actions sit right under the hero; on desktop they live in the sidebar. */}
          {!isDesktop ? <GameActions game={game} /> : null}
          <About summary={game.summary} storyline={game.storyline} />
          <ScreenshotStrip imageIds={game.screenshotIds} gameName={game.name} />
          <CommunityReviews gameId={game.id} />
        </View>
        <View className="gap-3 md:flex-[2]">
          {isDesktop ? <GameActions game={game} /> : null}
          <GameFacts game={game} />
          <SystemRequirementsPanel requirements={game.systemRequirements} hasPc={hasPc} />
        </View>
      </View>
    </ScrollView>
  );
}
