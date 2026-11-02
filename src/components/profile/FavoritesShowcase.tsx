import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GamePickerModal } from '@/components/studio/GamePickerModal';
import { SteamAlert, SteamPanel, SteamSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useFavoriteMutation, useFavorites } from '@/hooks/useProfile';
import type { FavoriteRank } from '@/types/database.types';
import { cn } from '@/utils/cn';

import { CoverTile } from './CoverTile';

const RANKS: readonly FavoriteRank[] = [1, 2, 3, 4];

function TinyButton({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      className={cn('steam-bevel h-5 flex-1 items-center justify-center bg-steam-button', disabled && 'opacity-30')}
    >
      <Text className="text-steam-xs font-bold text-steam-text-bright">{label}</Text>
    </Pressable>
  );
}

type FavoritesShowcaseProps = { userId: string; editable: boolean };

/** Top 4 all-time favorites. Owners pick, reorder (◀ ▶) and clear (✕) entries. */
export function FavoritesShowcase({ userId, editable }: FavoritesShowcaseProps) {
  const favorites = useFavorites(userId);
  const rows = favorites.data ?? [];
  const games = useGameLookup(rows.map((r) => r.game_id));
  const mutation = useFavoriteMutation();
  const [pickingRank, setPickingRank] = useState<FavoriteRank | null>(null);

  // Picking a game that is already ranked moves it (set_favorite RPC), so annotate rather than block.
  const annotations = new Map(rows.map((r) => [r.game_id, `Rank ${r.rank} — moves here`] as const));

  return (
    <SteamPanel title="Top 4 Favorites">
      {favorites.isPending ? (
        <SteamSpinner label="Loading favorites…" />
      ) : favorites.isError ? (
        <SteamAlert message={favorites.error.message} />
      ) : !editable && rows.length === 0 ? (
        <Text className="text-steam-sm text-steam-text-muted">No favorites picked yet.</Text>
      ) : (
        <View className="gap-2">
          {mutation.isError ? <SteamAlert message={mutation.error.message} /> : null}
          <View className="flex-row gap-2">
            {RANKS.map((rank) => {
              const row = rows.find((r) => r.rank === rank);
              const game = row ? games.data?.get(row.game_id) : undefined;
              const tile = (
                <CoverTile
                  game={game}
                  gameId={row?.game_id ?? null}
                  loading={games.isFetching}
                  emptyLabel={editable ? '+ Pick' : '—'}
                />
              );
              return (
                <View key={rank} className="flex-1 gap-1">
                  <Text className="font-mono text-steam-xs font-bold text-steam-highlight">#{rank}</Text>
                  {editable ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={row ? `Replace favorite #${rank}` : `Pick favorite #${rank}`}
                      onPress={() => setPickingRank(rank)}
                    >
                      {tile}
                    </Pressable>
                  ) : (
                    tile
                  )}
                  <Text className="min-h-[14px] text-steam-xs text-steam-text-bright" numberOfLines={1}>
                    {row ? (game?.name ?? '…') : ''}
                  </Text>
                  {editable && row ? (
                    <View className="flex-row gap-px">
                      <TinyButton
                        label="◀"
                        a11y={`Move #${rank} up`}
                        disabled={rank === 1}
                        onPress={() => mutation.mutate({ action: 'swap', a: rank, b: (rank - 1) as FavoriteRank })}
                      />
                      <TinyButton label="✕" a11y={`Remove favorite #${rank}`} onPress={() => mutation.mutate({ action: 'remove', rank })} />
                      <TinyButton
                        label="▶"
                        a11y={`Move #${rank} down`}
                        disabled={rank === 4}
                        onPress={() => mutation.mutate({ action: 'swap', a: rank, b: (rank + 1) as FavoriteRank })}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {editable ? (
        <GamePickerModal
          visible={pickingRank !== null}
          title={`Favorite #${pickingRank ?? ''}`}
          currentGameId={pickingRank ? rows.find((r) => r.rank === pickingRank)?.game_id : null}
          annotations={annotations}
          onClose={() => setPickingRank(null)}
          onPick={(game) => {
            if (pickingRank !== null) mutation.mutate({ action: 'set', rank: pickingRank, gameId: game.id });
            setPickingRank(null);
          }}
        />
      ) : null}
    </SteamPanel>
  );
}
