import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { PlayedOnBadge } from '@/components/game/PlayedOnBadge';
import { formatFinishedOn } from '@/components/game/ReplayButton';
import { CoverTile } from '@/components/profile/CoverTile';
import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCPanel,
  RetroGamingPCRating,
  RetroGamingPCSpinner,
  RetroGamingPCTimeAgo,
} from '@/components/ui';
import { ReviewLikeControl } from '@/components/review/ReviewCard';
import { ReviewComments } from '@/components/review/ReviewComments';
import { MoreMenu } from '@/components/safety/MoreMenu';
import { UserName, useShownName } from '@/components/user/UserName';
import { useAuthStore, useIsGuest } from '@/hooks/useAuth';
import { useGameLookup } from '@/hooks/useGames';
import { useReviewLikes } from '@/hooks/useReviewBrowser';
import { usePlaythroughs, useReview } from '@/hooks/useReviews';
import { useStudioStore } from '@/hooks/useStudioStore';
import { useThemeColors } from '@/hooks/useTheme';
import { TOUCH_SLOP } from '@/utils/platform';
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
  const authorName = useShownName(review.data?.author?.id, review.data?.author?.username ?? '').name;
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const startReview = useStudioStore((s) => s.startReview);
  const games = useGameLookup(review.data ? [review.data.game_id] : []);
  const likes = useReviewLikes(valid && review.data?.status === 'published' ? [id] : []);
  const playthroughs = usePlaythroughs(valid && review.data?.status === 'published' ? id : null);
  const isGuest = useIsGuest();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const commentsY = useRef(0);
  const themeColors = useThemeColors();
  const commentCount = likes.data?.get(id)?.comments ?? 0;

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
    <ScrollView
      ref={scrollRef}
      className="flex-1 bg-retrogamingpc-dark"
      contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[760px]"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: `${author ? authorName : 'Player'} on ${game?.name ?? 'a game'}` }} />

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
                  {author ? (
                    <UserName userId={author.id} username={author.username} className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" />
                  ) : (
                    <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright">Unknown player</Text>
                  )}
                  {isMine ? <RetroGamingPCBadge label="You" variant="nowPlaying" /> : null}
                  {data.status === 'draft' ? <RetroGamingPCBadge label="Draft" variant="draft" /> : null}
                  {data.is_replay ? <RetroGamingPCBadge label="↻ Replay" /> : null}
                </View>
                <RetroGamingPCTimeAgo iso={data.published_at ?? data.updated_at} onPress={openAuthor} />
              </View>
            </Pressable>
            <RetroGamingPCRating rating={reviewRating(data)} expanded />
            <PlayedOnBadge platformId={data.platform_id} />
            {data.is_replay && data.finished_on ? (
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Finished {formatFinishedOn(data.finished_on)}</Text>
            ) : null}
            {data.status === 'published' && (commentCount > 0 || !isGuest) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={commentCount > 0 ? `Jump to ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : 'Jump to comments'}
                hitSlop={TOUCH_SLOP}
                onPress={() => scrollRef.current?.scrollTo({ y: commentsY.current, animated: true })}
                className="min-h-[28px] flex-row items-center gap-1 self-start"
              >
                <MaterialCommunityIcons name="comment-outline" size={13} color={themeColors.textBright} />
                <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright underline">
                  {commentCount > 0 ? `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'} ▾` : 'Comment ▾'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </RetroGamingPCPanel>

      {playthroughs.data && playthroughs.data.length > 1 ? (
        <RetroGamingPCPanel>
          <View className="gap-1.5">
            <Text className="retrogamingpc-label">
              Review {playthroughs.data.find((p) => p.id === data.id)?.n ?? '?'} of {playthroughs.data.length} for this game
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {playthroughs.data.map((p) =>
                p.id === data.id ? (
                  <RetroGamingPCBadge key={p.id} label={`#${p.n} · ${formatDate(p.published_at)}`} variant="main" />
                ) : (
                  <RetroGamingPCButton
                    key={p.id}
                    variant="navigate"
                    label={`#${p.n} · ${formatDate(p.published_at)}`}
                    accessibilityLabel={`Open review ${p.n} of ${p.total}`}
                    onPress={() => router.replace({ pathname: '/review/[id]', params: { id: p.id } })}
                  />
                ),
              )}
            </View>
          </View>
        </RetroGamingPCPanel>
      ) : null}

      <RetroGamingPCPanel title="Review">
        {data.content ? (
          <Text className="text-retrogamingpc-sm leading-[18px] text-retrogamingpc-text" selectable>
            {data.content}
          </Text>
        ) : (
          <Text className="text-retrogamingpc-sm italic text-retrogamingpc-text-muted">Score-only review (no written text).</Text>
        )}
      </RetroGamingPCPanel>

      {/* One action bar: ♥ on the left; navigation, editing and ⋯ (report) on the right. */}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        {data.status === 'published' ? <ReviewLikeControl reviewId={data.id} isMine={isMine} like={likes.data?.get(data.id)} /> : <View />}
        <View className="flex-row flex-wrap items-center justify-end gap-2">
          {data.status === 'published' ? (
            <RetroGamingPCButton
              variant="navigate"
              label={`All reviews of ${game?.name ?? 'this game'} ▸`}
              onPress={() => router.push({ pathname: '/reviews/[gameId]', params: { gameId: String(data.game_id) } })}
            />
          ) : null}
          {isMine ? (
            <RetroGamingPCButton
              variant="navigate"
              label="Edit in Review Studio"
              onPress={() => {
                startReview({ gameId: data.game_id, reviewId: data.id });
                router.push('/post');
              }}
            />
          ) : author ? (
            <MoreMenu
              label="this review"
              report={{ targetType: 'review', targetId: data.id, targetUserId: data.user_id, label: 'this review', ownerName: authorName }}
            />
          ) : null}
        </View>
      </View>

      {data.status === 'published' ? (
        <View onLayout={(e) => (commentsY.current = e.nativeEvent.layout.y)}>
          <ReviewComments reviewId={data.id} viewerId={viewerId} />
        </View>
      ) : null}
    </ScrollView>
  );
}
