import { router, Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';

import { GuestPrompt } from '@/components/auth/MembersOnly';
import { ReviewCard } from '@/components/review/ReviewCard';
import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCButton,
  RetroGamingPCPanel,
  RetroGamingPCRating,
  RetroGamingPCSpinner,
  RetroGamingPCTabs,
  type RetroGamingPCTabItem,
} from '@/components/ui';
import { useIsGuest, useMemberId } from '@/hooks/useAuth';
import { useFriendRatingsForGame } from '@/hooks/useGameDetail';
import { useGameLookup } from '@/hooks/useGames';
import { useReviewBrowser, useReviewLikesByPage } from '@/hooks/useReviewBrowser';
import type { ReviewScope, ReviewSort } from '@/services/reviewBrowser';
import { igdbImageUrl } from '@/types/igdb';
import { reviewRating } from '@/utils/ratingColumns';

const SCOPES: readonly RetroGamingPCTabItem<ReviewScope>[] = [
  { key: 'community', label: 'Community' },
  { key: 'friends', label: 'Friends' },
];

const SORTS: readonly RetroGamingPCTabItem<ReviewSort>[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'recent', label: 'Recent' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
];

const isScope = (v: unknown): v is ReviewScope => v === 'community' || v === 'friends';
const isSort = (v: unknown): v is ReviewSort => v === 'popular' || v === 'recent' || v === 'highest' || v === 'lowest';

/** Friends who scored the game without writing a review (bottom of the Friends tab). */
function AlsoRated({ gameId }: { gameId: number }) {
  const friends = useFriendRatingsForGame(gameId);
  const scoreOnly = (friends.data ?? []).filter((f) => f.review_id === null);
  if (scoreOnly.length === 0) return null;
  return (
    <RetroGamingPCPanel title={`Also rated (${scoreOnly.length})`} className="mt-2">
      <View className="gap-2">
        {scoreOnly.map((f) => (
          <Pressable
            key={f.user_id}
            accessibilityRole="link"
            accessibilityLabel={`${f.username}. Open profile`}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: f.user_id } })}
            className="flex-row items-center gap-2"
          >
            <Thumbnail uri={f.avatar_url} fallback={f.username} shape="square" accessibilityLabel="" />
            <Text className="flex-1 text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
              {f.username}
            </Text>
            <View pointerEvents="none">
              <RetroGamingPCRating rating={reviewRating(f)} size="compact" expanded={false} />
            </View>
          </Pressable>
        ))}
      </View>
    </RetroGamingPCPanel>
  );
}

/**
 * The review browser: every published review of one game. Community | Friends
 * (`?tab=`), sorted Popular / Recent / Highest / Lowest (`?sort=`). Each card
 * opens the full review. Popular uses review likes, whose counts stay private.
 */
export default function ReviewBrowserScreen() {
  const params = useLocalSearchParams<{ gameId: string; tab?: string; sort?: string }>();
  const gameId = Number(params.gameId);
  const validGame = Number.isSafeInteger(gameId) && gameId > 0;
  const scope: ReviewScope = isScope(params.tab) ? params.tab : 'community';
  const sort: ReviewSort = isSort(params.sort) ? params.sort : 'popular';
  const isGuest = useIsGuest();
  const viewerId = useMemberId();
  const lockedForGuest = isGuest && scope === 'friends';

  const games = useGameLookup(validGame ? [gameId] : []);
  const game = games.data?.get(gameId);
  const list = useReviewBrowser(validGame ? gameId : null, scope, sort, !lockedForGuest);
  const pages = list.data?.pages ?? [];
  // Pages are fetched by position, so a review published (or Popular reshuffled) mid-scroll can
  // reappear on the next page: keep the first copy only.
  const seen = new Set<string>();
  const reviews = pages.flatMap((p) => p.reviews).filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  const likes = useReviewLikesByPage(pages.map((p) => p.reviews.map((r) => r.id)));

  if (!validGame) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Reviews' }} />
        <RetroGamingPCAlert message="This game doesn't exist." />
      </View>
    );
  }

  const header = (
    <View className="gap-2 pb-2">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${game?.name ?? 'the game'}`}
        onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(gameId) } })}
        className="flex-row items-center gap-2 self-start"
      >
        <Thumbnail
          uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
          fallback={game?.name ?? '?'}
          shape="cover"
          accessibilityLabel=""
        />
        <Text className="text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright underline">{game?.name ?? 'Loading…'}</Text>
      </Pressable>
      <RetroGamingPCTabs items={SCOPES} value={scope} onChange={(tab) => router.setParams({ tab })} fill />
      {lockedForGuest ? null : <RetroGamingPCTabs items={SORTS} value={sort} onChange={(next) => router.setParams({ sort: next })} fill />}
    </View>
  );

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title: game ? `Reviews · ${game.name}` : 'Reviews' }} />
      {lockedForGuest ? (
        <View className="w-full gap-3 self-center p-3 md:max-w-[860px]">
          {header}
          <RetroGamingPCPanel title="Friends' reviews">
            <GuestPrompt feature="add friends and see their reviews" />
          </RetroGamingPCPanel>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-2 p-3 md:max-w-[860px] md:w-full md:self-center"
          ListHeaderComponent={header}
          renderItem={({ item }) => <ReviewCard review={item} viewerId={viewerId} like={likes.get(item.id)} excerptLines={6} />}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            list.isPending ? (
              <RetroGamingPCSpinner label="Loading reviews…" />
            ) : list.isError ? (
              <View className="gap-2">
                <RetroGamingPCAlert message={list.error.message} />
                <View className="flex-row justify-end">
                  <RetroGamingPCButton label="Retry" onPress={() => void list.refetch()} />
                </View>
              </View>
            ) : (
              <RetroGamingPCAlert
                tone="info"
                message={
                  scope === 'friends' ? 'None of your friends have reviewed this game yet.' : 'No reviews yet. Be the first to write one.'
                }
              />
            )
          }
          ListFooterComponent={
            <>
              {list.isFetchingNextPage ? <RetroGamingPCSpinner label="Loading more…" /> : null}
              {scope === 'friends' && !list.hasNextPage ? <AlsoRated gameId={gameId} /> : null}
            </>
          }
        />
      )}
    </View>
  );
}
