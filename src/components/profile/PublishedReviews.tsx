import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { SteamAlert, SteamCard, SteamPanel, SteamRating, SteamSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { usePublishedReviews } from '@/hooks/useProfile';
import { igdbImageUrl } from '@/types/igdb';
import { reviewRating } from '@/utils/ratingColumns';

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

/** A player's published reviews (RLS hides their drafts from everyone else). */
export function PublishedReviews({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const reviews = usePublishedReviews(userId);
  const games = useGameLookup((reviews.data ?? []).map((r) => r.game_id));

  return (
    <SteamPanel title={`Reviews${reviews.data ? ` (${reviews.data.length})` : ''}`}>
      {reviews.isPending ? (
        <SteamSpinner label="Loading reviews…" />
      ) : reviews.isError ? (
        <SteamAlert message={reviews.error.message} />
      ) : reviews.data.length === 0 ? (
        <Text className="text-steam-sm text-steam-text-muted">
          {isOwner ? 'You haven’t published a review yet. Head to the Review Studio.' : 'No published reviews yet.'}
        </Text>
      ) : (
        <View className="gap-2">
          {reviews.data.map((review) => {
            const game = games.data?.get(review.game_id);
            return (
              <SteamCard
                key={review.id}
                className="flex-row gap-3"
                accessibilityLabel={`Review of ${game?.name ?? 'game'}`}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(review.game_id) } })}
              >
                <Thumbnail
                  uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
                  fallback={game?.name ?? '?'}
                  shape="cover"
                  accessibilityLabel={`${game?.name ?? 'Game'} cover`}
                />
                <View className="flex-1 gap-1">
                  <Text className="text-steam-base font-bold text-steam-text-bright" numberOfLines={1}>
                    {game?.name ?? `Game #${review.game_id}`}
                  </Text>
                  <SteamRating rating={reviewRating(review)} size="compact" />
                  {review.content ? (
                    <Text className="text-steam-xs text-steam-text" numberOfLines={3}>
                      {review.content}
                    </Text>
                  ) : null}
                  <Text className="text-steam-xs text-steam-text-muted">{formatDate(review.published_at)}</Text>
                </View>
              </SteamCard>
            );
          })}
        </View>
      )}
    </SteamPanel>
  );
}
