import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CoverRemoveButton } from '@/components/games/CoverRemoveButton';
import { GamePickerModal } from '@/components/studio/GamePickerModal';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useFavoriteMutation, useFavorites } from '@/hooks/useProfile';
import type { FavoriteRank } from '@/types/database.types';

import { CoverTile } from './CoverTile';

const SLOTS: readonly FavoriteRank[] = [1, 2, 3, 4];

type FavoritesShowcaseProps = { userId: string; editable: boolean };

/**
 * Four all-time favourites. A filled slot opens the game's page; owners pick a
 * game for an empty slot and clear one with the ✕ on its cover. To change a
 * game, clear it and pick a new one for the freed slot.
 */
export function FavoritesShowcase({ userId, editable }: FavoritesShowcaseProps) {
  const favorites = useFavorites(userId);
  const rows = favorites.data ?? [];
  const games = useGameLookup(rows.map((r) => r.game_id));
  const mutation = useFavoriteMutation();
  const [pickingSlot, setPickingSlot] = useState<FavoriteRank | null>(null);

  // Picking a game that is already a favourite moves it (set_favorite RPC), so annotate rather than block.
  const annotations = new Map(rows.map((r) => [r.game_id, 'Already a favourite — moves here'] as const));

  return (
    <RetroGamingPCPanel title="Favourites">
      {favorites.isPending ? (
        <RetroGamingPCSpinner label="Loading favourites…" />
      ) : favorites.isError ? (
        <RetroGamingPCAlert message={favorites.error.message} />
      ) : !editable && rows.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No favourites picked yet.</Text>
      ) : (
        <View className="gap-2">
          {mutation.isError ? <RetroGamingPCAlert message={mutation.error.message} /> : null}
          <View className="flex-row gap-2">
            {SLOTS.map((slot) => {
              const row = rows.find((r) => r.rank === slot);
              const game = row ? games.data?.get(row.game_id) : undefined;
              const name = game?.name ?? 'game';
              const tile = (
                <CoverTile game={game} gameId={row?.game_id ?? null} loading={games.isFetching} emptyLabel={editable ? '+ Pick' : '—'} />
              );
              return (
                <View key={slot} className="flex-1 gap-1">
                  <View>
                    {row ? (
                      <Pressable
                        accessibilityRole="link"
                        accessibilityLabel={`Favourite: ${name}. Open game page`}
                        onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(row.game_id) } })}
                      >
                        {tile}
                      </Pressable>
                    ) : editable ? (
                      <Pressable accessibilityRole="button" accessibilityLabel="Pick a favourite" onPress={() => setPickingSlot(slot)}>
                        {tile}
                      </Pressable>
                    ) : (
                      tile
                    )}
                    {editable && row ? (
                      <CoverRemoveButton name={`${name} from your favourites`} onPress={() => mutation.mutate({ action: 'remove', rank: slot })} />
                    ) : null}
                  </View>
                  <Text className="min-h-[14px] text-retrogamingpc-xs text-retrogamingpc-text-bright" numberOfLines={1}>
                    {row ? (game?.name ?? '…') : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {editable ? (
        <GamePickerModal
          visible={pickingSlot !== null}
          title="Pick a favourite"
          currentGameId={pickingSlot ? rows.find((r) => r.rank === pickingSlot)?.game_id : null}
          annotations={annotations}
          onClose={() => setPickingSlot(null)}
          onPick={(game) => {
            if (pickingSlot !== null) mutation.mutate({ action: 'set', rank: pickingSlot, gameId: game.id });
            setPickingSlot(null);
          }}
        />
      ) : null}
    </RetroGamingPCPanel>
  );
}
