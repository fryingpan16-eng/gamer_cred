import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { CoverGridScreen } from '@/components/games/CoverGridScreen';
import { RetroGamingPCAlert } from '@/components/ui';
import { useLikedGames } from '@/hooks/useLikes';
import { useProfile, useViewerId } from '@/hooks/useProfile';
import { LIKED_GAMES_MAX } from '@/services/likes';
import { shownName } from '@/utils/nameRules';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every game a player likes, newest first, with a name filter. */
export default function LikedGamesScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const validId = typeof userId === 'string' && UUID_PATTERN.test(userId);
  const viewerId = useViewerId();
  const profile = useProfile(validId ? userId : null);
  const liked = useLikedGames(validId ? userId : null);
  const isOwner = validId && userId === viewerId;
  const title = isOwner ? 'Your Liked Games' : profile.data ? `${shownName(profile.data.username, profile.data.display_name)}’s Liked Games` : 'Liked Games';

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title }} />
      {validId ? (
        <CoverGridScreen
          gameIds={liked.data?.gameIds}
          total={liked.data?.total ?? 0}
          max={LIKED_GAMES_MAX}
          isPending={liked.isPending}
          error={liked.error}
          onRetry={() => void liked.refetch()}
          emptyText="No liked games yet."
          filterLabel="Filter liked games"
        />
      ) : (
        <View className="p-3">
          <RetroGamingPCAlert message="This player doesn't exist." />
        </View>
      )}
    </View>
  );
}
