import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { PlayedOnBadge } from '@/components/game/PlayedOnBadge';
import { MoreMenu } from '@/components/safety/MoreMenu';
import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCBadge, RetroGamingPCCard, RetroGamingPCRating, RetroGamingPCTimeAgo } from '@/components/ui';
import { UserName, useShownName } from '@/components/user/UserName';
import { useIsGuest } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';
import { useToggleReviewLike } from '@/hooks/useReviewBrowser';
import type { ReviewCardData, ReviewLikeInfo } from '@/services/reviewBrowser';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { TOUCH_SLOP } from '@/utils/platform';

export type ReviewCardProps = {
  review: ReviewCardData;
  /** Signed-in member's id (to mark "You" and hide ♥/Report on your own review). */
  viewerId: string | null;
  /** Your ♥ state for this review (from useReviewLikes); omitted = still loading. */
  like?: ReviewLikeInfo;
  /** Show which game it's about (feeds, profiles). Off on a game's own pages. */
  showGame?: boolean;
  game?: IgdbGameResult;
  /** Show the reviewer (off on a profile, where it's always them). */
  showAuthor?: boolean;
  /** Lines of text before "…"; the full review is one tap away. */
  excerptLines?: number;
};

/** ♥ for someone else's review; on your own, the private count (only you see it). */
export function ReviewLikeControl({ reviewId, isMine, like }: { reviewId: string; isMine: boolean; like?: ReviewLikeInfo }) {
  const themeColors = useThemeColors();
  const isGuest = useIsGuest();
  const toggle = useToggleReviewLike();
  if (isMine) {
    const n = like?.count ?? 0;
    return n > 0 ? (
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        <Text style={{ color: themeColors.like }}>♥ {n}</Text> {n === 1 ? 'person likes' : 'people like'} your review · only you see this
      </Text>
    ) : null;
  }
  if (isGuest || !like) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={like.liked ? 'Unlike this review' : 'Like this review'}
      accessibilityState={{ selected: like.liked }}
      hitSlop={TOUCH_SLOP}
      onPress={() => toggle.mutate({ reviewId, liked: !like.liked })}
      className="min-h-[28px] flex-row items-center gap-1"
    >
      <MaterialCommunityIcons name={like.liked ? 'heart' : 'heart-outline'} size={14} color={themeColors.like} />
      <Text className="text-retrogamingpc-xs font-bold" style={{ color: themeColors.like }}>
        {like.liked ? 'Liked' : 'Like'}
      </Text>
    </Pressable>
  );
}

/**
 * THE review preview, used everywhere a review appears (Home feeds, game page,
 * review browser, profiles). Tap: avatar / name → profile · game → game page ·
 * anywhere else → the full review (/review/[id]) · ♥ → like.
 */
export function ReviewCard({
  review,
  viewerId,
  like,
  showGame = false,
  game,
  showAuthor = true,
  excerptLines = 4,
}: ReviewCardProps) {
  const isMine = review.userId === viewerId;
  const themeColors = useThemeColors();
  const author = review.author;
  const authorName = useShownName(author?.id, author?.username ?? '').name;
  const gameName = game?.name ?? `Game #${review.gameId}`;
  const openReview = () => router.push({ pathname: '/review/[id]', params: { id: review.id } });
  const openAuthor = () => author && router.push(isMine ? '/profile' : { pathname: '/user/[id]', params: { id: author.id } });
  const openGame = () => router.push({ pathname: '/game/[id]', params: { id: String(review.gameId) } });

  return (
    <RetroGamingPCCard
      className="gap-2"
      onPress={openReview}
      accessibilityRole="link"
      accessibilityLabel={`${showAuthor && author ? `${authorName}'s review` : 'Review'}${showGame ? ` of ${gameName}` : ''}. Open review`}
    >
      <View className="flex-row gap-3">
        {showAuthor && author ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${authorName}'s profile`} onPress={openAuthor} hitSlop={4}>
            <Thumbnail uri={author.avatar_url} fallback={author.username} shape="square" accessibilityLabel="" />
          </Pressable>
        ) : null}
        <View className="flex-1 gap-0.5">
          {showAuthor ? (
            <View className="flex-row flex-wrap items-center gap-1">
              {author ? (
                <Text onPress={openAuthor} numberOfLines={1}>
                  <UserName userId={author.id} username={author.username} className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" />
                </Text>
              ) : (
                <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright">Unknown player</Text>
              )}
              {isMine ? <RetroGamingPCBadge label="You" variant="nowPlaying" /> : null}
              {showGame ? (
                <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
                  reviewed{' '}
                  <Text onPress={openGame} className="font-bold text-retrogamingpc-text-bright">
                    {gameName}
                  </Text>
                </Text>
              ) : null}
            </View>
          ) : showGame ? (
            <Text onPress={openGame} className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
              {gameName}
            </Text>
          ) : null}
          <View pointerEvents="none">
            <RetroGamingPCRating rating={review.rating} size="compact" />
          </View>
          <PlayedOnBadge platformId={review.platformId} />
          {review.isReplay ? (
            <View className="flex-row">
              <RetroGamingPCBadge label="↻ Replay" />
            </View>
          ) : null}
          {review.date ? <RetroGamingPCTimeAgo iso={review.date} onPress={openReview} /> : null}
        </View>
        {showGame ? (
          <Pressable accessibilityRole="link" accessibilityLabel={`Open ${gameName}`} onPress={openGame}>
            <Thumbnail
              uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
              fallback={gameName}
              shape="cover"
              accessibilityLabel=""
            />
          </Pressable>
        ) : null}
      </View>

      {review.content ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text" numberOfLines={excerptLines}>
          {review.content}
        </Text>
      ) : (
        <Text className="text-retrogamingpc-xs italic text-retrogamingpc-text-muted">Score-only review (no written text).</Text>
      )}

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <ReviewLikeControl reviewId={review.id} isMine={isMine} like={like} />
        <View className="flex-row flex-wrap items-center gap-3">
          {like && like.comments > 0 ? (
            <View
              className="flex-row items-center gap-1"
              accessible
              accessibilityLabel={`${like.comments} ${like.comments === 1 ? 'comment' : 'comments'}`}
            >
              <MaterialCommunityIcons name="comment-outline" size={13} color={themeColors.text} />
              <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text">{like.comments}</Text>
            </View>
          ) : null}
          <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright underline">Read review ▸</Text>
          {!isMine && author ? (
            <MoreMenu
              label={`${authorName}'s review`}
              report={{
                targetType: 'review',
                targetId: review.id,
                targetUserId: review.userId,
                label: `${authorName}'s review`,
                ownerName: authorName,
              }}
            />
          ) : null}
        </View>
      </View>
    </RetroGamingPCCard>
  );
}
