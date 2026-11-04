import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { LIKE_COLOR } from '@/constants/likeColor';
import { useGameLookup } from '@/hooks/useGames';
import { useLikedGames } from '@/hooks/useLikes';

import { CoverTile } from './CoverTile';

const PREVIEW = 8;

/** ♥ Liked Games on a profile: the latest 8 covers, and View all for the full list. */
export function LikedGamesShowcase({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const liked = useLikedGames(userId);
  const ids = (liked.data?.gameIds ?? []).slice(0, PREVIEW);
  const games = useGameLookup(ids);
  const total = liked.data?.total ?? 0;

  return (
    <RetroGamingPCPanel
      title={`♥ Liked Games${liked.data ? ` (${total})` : ''}`}
      headerRight={
        total > 0 ? (
          <RetroGamingPCButton
            variant="navigate"
            label="View all"
            onPress={() => router.push({ pathname: '/likes/[userId]', params: { userId } })}
          />
        ) : undefined
      }
    >
      {liked.isPending ? (
        <RetroGamingPCSpinner label="Loading liked games…" />
      ) : liked.isError ? (
        <RetroGamingPCAlert message={liked.error.message} />
      ) : ids.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          {isOwner ? (
            <>
              Tap <Text style={{ color: LIKE_COLOR }}>♥ Like</Text> on any game page to collect games here, no rating needed.
            </>
          ) : (
            'No liked games yet.'
          )}
        </Text>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {ids.map((id) => {
            const game = games.data?.get(id);
            return (
              <Pressable
                key={id}
                accessibilityRole="link"
                accessibilityLabel={`${game?.name ?? 'Game'}. Open game page`}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(id) } })}
                className="w-[22%] min-w-[64px] flex-grow"
                style={{ maxWidth: 120 }}
              >
                <CoverTile game={game} gameId={id} loading={games.isPending} />
              </Pressable>
            );
          })}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
