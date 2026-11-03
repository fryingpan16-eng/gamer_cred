import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PlayedOnBadge } from '@/components/game/PlayedOnBadge';
import { CoverTile } from '@/components/profile/CoverTile';
import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCPanel,
  RetroGamingPCRating,
  RetroGamingPCSpinner,
} from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useGameLookup } from '@/hooks/useGames';
import { useReview } from '@/hooks/useReviews';
import { useStudioStore } from '@/hooks/useStudioStore';
import { reviewRating } from '@/utils/ratingColumns';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : '';
}

/** One review in full: game, author, rating (in your scale), platform played on, and the text. */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const valid = typeof id === 'string' && UUID_PATTERN.test(id);
  const review = useReview(valid ? id : null);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const startReview = useStudioStore((s) => s.startReview);
  const games = useGameLookup(review.data ? [review.data.game_id] : []);

  if (valid && review.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-retrogamingpc-dark">
        <Stack.Screen options={{ title: 'Review' }} />
        <RetroGamingPCSpinner label="Loading review…" />
      </View>
    );
  }

  const data = review.data;
  if (!valid || review.isError || !data) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Review not found' }} />
        <RetroGamingPCPanel title="Review not found">
          <RetroGamingPCAlert message={review.error?.message ?? 'This review doesn’t exist or isn’t published.'} />
        </RetroGamingPCPanel>
      </View>
    );
  }

  const game = games.data?.get(data.game_id);
  const author = data.author;
  const isMine = data.user_id === viewerId;
  const openGame = () => router.push({ pathname: '/game/[id]', params: { id: String(data.game_id) } });
  const openAuthor = () => author && router.push(isMine ? '/profile' : { pathname: '/user/[id]', params: { id: author.id } });

  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[760px]">
      <Stack.Screen options={{ title: `${author?.username ?? 'Player'} on ${game?.name ?? 'a game'}` }} />

      <RetroGamingPCPanel>
        <View className="flex-row gap-3">
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${game?.name ?? 'game'}`} onPress={openGame} className="w-20">
            <CoverTile game={game} gameId={data.game_id} loading={games.isFetching} />
          </Pressable>
          <View className="flex-1 gap-1.5">
            <Text onPress={openGame} className="text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright">
              {game?.name ?? `Game #${data.game_id}`}
            </Text>
            <Pressable accessibilityRole="link" onPress={openAuthor} className="flex-row items-center gap-2 self-start">
              <Thumbnail uri={author?.avatar_url ?? null} fallback={author?.username ?? '?'} shape="square" accessibilityLabel="" />
              <View>
                <View className="flex-row items-center gap-1">
                  <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright">{author?.username ?? 'Unknown player'}</Text>
                  {isMine ? <RetroGamingPCBadge label="You" variant="nowPlaying" /> : null}
                  {data.status === 'draft' ? <RetroGamingPCBadge label="Draft" variant="draft" /> : null}
                </View>
                <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{formatDate(data.published_at ?? data.updated_at)}</Text>
              </View>
            </Pressable>
            <RetroGamingPCRating rating={reviewRating(data)} expanded />
            <PlayedOnBadge platformId={data.platform_id} />
          </View>
        </View>
      </RetroGamingPCPanel>

      <RetroGamingPCPanel title="Review">
        {data.content ? (
          <Text className="text-retrogamingpc-sm leading-[18px] text-retrogamingpc-text" selectable>
            {data.content}
          </Text>
        ) : (
          <Text className="text-retrogamingpc-sm italic text-retrogamingpc-text-muted">Score-only review (no written text).</Text>
        )}
      </RetroGamingPCPanel>

      {isMine ? (
        <View className="flex-row justify-end">
          <RetroGamingPCButton variant="navigate"
            label="Edit in Review Studio"
            onPress={() => {
              startReview({ gameId: data.game_id });
              router.push('/post');
            }}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
