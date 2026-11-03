import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { PlayedOnBadge } from '@/components/game/PlayedOnBadge';
import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useUserRatings } from '@/hooks/useRatings';
import { igdbImageUrl } from '@/types/igdb';

/**
 * A player's ratings (quick ratings and reviewed games — one score each),
 * newest first. Public: everyone who can see the profile sees these.
 * Written reviews are listed separately in PublishedReviews.
 */
export function ProfileRatings({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const ratings = useUserRatings(userId);
  const rows = ratings.data?.ratings ?? [];
  const games = useGameLookup(rows.map((r) => r.gameId));
  const total = ratings.data?.total ?? 0;
  const openList = () => router.push({ pathname: '/ratings/[userId]', params: { userId } });

  return (
    <RetroGamingPCPanel
      title={`Ratings${ratings.data ? ` (${total})` : ''}`}
      onTitlePress={openList}
      titleAccessibilityLabel="Ratings: open the full list"
      headerRight={rows.length > 0 ? <RetroGamingPCButton variant="navigate" label="View all" onPress={openList} /> : undefined}
    >
      {ratings.isPending ? (
        <RetroGamingPCSpinner label="Loading ratings…" />
      ) : ratings.isError ? (
        <RetroGamingPCAlert message={ratings.error.message} />
      ) : rows.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          {isOwner ? 'Rate games from search or any game page — your ratings show here.' : 'No ratings yet.'}
        </Text>
      ) : (
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            {rows.map((r) => {
              const game = games.data?.get(r.gameId);
              return (
                <Pressable
                  key={r.gameId}
                  accessibilityRole="link"
                  accessibilityLabel={`${game?.name ?? 'Game'}, open game page`}
                  onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(r.gameId) } })}
                  className="retrogamingpc-bevel w-[150px] flex-row gap-2 bg-retrogamingpc-card p-1.5"
                >
                  <Thumbnail
                    uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
                    fallback={game?.name ?? '?'}
                    shape="cover"
                    accessibilityLabel=""
                  />
                  <View className="flex-1 gap-0.5">
                    <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright" numberOfLines={2}>
                      {game?.name ?? `Game #${r.gameId}`}
                    </Text>
                    <View pointerEvents="none">
                      <RetroGamingPCRating rating={r} size="compact" expanded={false} />
                    </View>
                    <PlayedOnBadge platformId={r.platformId} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          {total > rows.length ? (
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
              Showing the {rows.length} most recent of {total}.{' '}
              <Text onPress={openList} className="text-retrogamingpc-text-bright underline">
                See them all
              </Text>
            </Text>
          ) : null}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
