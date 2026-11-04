import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { CoverTile } from '@/components/profile/CoverTile';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';

type CoverGridScreenProps = {
  gameIds: readonly number[] | undefined;
  total: number;
  /** Only this many were loaded (lists can be long). */
  max: number;
  isPending: boolean;
  error: Error | null;
  onRetry: () => void;
  emptyText: string;
  filterLabel: string;
};

/** A full-page grid of game covers with a name filter (Liked Games, Backlog). */
export function CoverGridScreen({ gameIds, total, max, isPending, error, onRetry, emptyText, filterLabel }: CoverGridScreenProps) {
  const games = useGameLookup(gameIds ?? []);
  const [filter, setFilter] = useState('');
  const needle = filter.trim().toLowerCase();
  const ids = (gameIds ?? []).filter((id) => !needle || (games.data?.get(id)?.name ?? '').toLowerCase().includes(needle));

  if (isPending) return <RetroGamingPCSpinner label="Loading games…" className="p-3" />;
  if (error) {
    return (
      <View className="gap-2 p-3">
        <RetroGamingPCAlert message={error.message} />
        <View className="flex-row justify-end">
          <RetroGamingPCButton label="Retry" onPress={onRetry} />
        </View>
      </View>
    );
  }
  return (
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
          <RetroGamingPCInput placeholder="Filter by name" value={filter} onChangeText={setFilter} accessibilityLabel={filterLabel} />
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            {total} game{total === 1 ? '' : 's'}, newest first
            {total > max ? ` (showing the latest ${max})` : ''}
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
      ListEmptyComponent={<RetroGamingPCAlert tone="info" message={needle ? 'No games match that name.' : emptyText} />}
    />
  );
}
