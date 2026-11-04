import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { CoverTile } from '@/components/profile/CoverTile';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useLikedGames } from '@/hooks/useLikes';
import { useProfile, useViewerId } from '@/hooks/useProfile';
import { LIKED_GAMES_MAX } from '@/services/likes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Every game a player likes, newest first, with a name filter. */
export default function LikedGamesScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const validId = typeof userId === 'string' && UUID_PATTERN.test(userId);
  const viewerId = useViewerId();
  const profile = useProfile(validId ? userId : null);
  const liked = useLikedGames(validId ? userId : null);
  const games = useGameLookup(liked.data?.gameIds ?? []);
  const [filter, setFilter] = useState('');

  const isOwner = validId && userId === viewerId;
  const title = isOwner ? 'Your Liked Games' : profile.data ? `${profile.data.username}’s Liked Games` : 'Liked Games';
  const needle = filter.trim().toLowerCase();
  const ids = (liked.data?.gameIds ?? []).filter((id) => !needle || (games.data?.get(id)?.name ?? '').toLowerCase().includes(needle));

  if (!validId) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Liked Games' }} />
        <RetroGamingPCAlert message="This player doesn't exist." />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title }} />
      {liked.isPending ? (
        <RetroGamingPCSpinner label="Loading liked games…" className="p-3" />
      ) : liked.isError ? (
        <View className="gap-2 p-3">
          <RetroGamingPCAlert message={liked.error.message} />
          <View className="flex-row justify-end">
            <RetroGamingPCButton label="Retry" onPress={() => void liked.refetch()} />
          </View>
        </View>
      ) : (
        <FlatList
          data={ids}
          keyExtractor={(id) => String(id)}
          numColumns={3}
          automaticallyAdjustKeyboardInsets
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="gap-2 p-3 md:max-w-[860px] md:w-full md:self-center"
          columnWrapperClassName="gap-2"
          ListHeaderComponent={
            <View className="gap-1 pb-1">
              <RetroGamingPCInput
                placeholder="Filter by name"
                value={filter}
                onChangeText={setFilter}
                accessibilityLabel="Filter liked games"
              />
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
                {liked.data.total} game{liked.data.total === 1 ? '' : 's'}, newest first
                {liked.data.total > LIKED_GAMES_MAX ? ` (showing the latest ${LIKED_GAMES_MAX})` : ''}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const game = games.data?.get(item);
            return (
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${game?.name ?? 'Game'}. Open game page`}
                onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(item) } })}
                className="flex-1 gap-1"
                style={{ maxWidth: '33%' }}
              >
                <CoverTile game={game} gameId={item} loading={games.isPending} />
                <Text className="text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={2}>
                  {game?.name ?? ''}
                </Text>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <RetroGamingPCAlert tone="info" message={needle ? 'No liked games match that name.' : 'No liked games yet.'} />
          }
        />
      )}
    </View>
  );
}
