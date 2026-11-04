import { router } from 'expo-router';
import { Text } from 'react-native';

import { CoverShowcase } from '@/components/games/CoverShowcase';
import { RetroGamingPCButton } from '@/components/ui';
import { LIKE_COLOR } from '@/constants/likeColor';
import { useLikedGames } from '@/hooks/useLikes';

/** ♥ Liked Games on a profile: the latest 8 covers, and View all for the full list. */
export function LikedGamesShowcase({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const liked = useLikedGames(userId);
  const total = liked.data?.total ?? 0;
  return (
    <CoverShowcase
      title={`♥ Liked Games${liked.data ? ` (${total})` : ''}`}
      gameIds={liked.data?.gameIds}
      isPending={liked.isPending}
      error={liked.error}
      headerRight={
        total > 0 ? (
          <RetroGamingPCButton
            variant="navigate"
            label="View all"
            onPress={() => router.push({ pathname: '/likes/[userId]', params: { userId } })}
          />
        ) : undefined
      }
      empty={
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          {isOwner ? (
            <>
              Tap <Text style={{ color: LIKE_COLOR }}>♥ Like</Text> on any game page to collect games here, no rating needed.
            </>
          ) : (
            'No liked games yet.'
          )}
        </Text>
      }
    />
  );
}
