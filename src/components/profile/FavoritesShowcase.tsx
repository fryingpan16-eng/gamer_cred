import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GamePickerModal } from '@/components/studio/GamePickerModal';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useFavoriteMutation, useFavorites } from '@/hooks/useProfile';
import type { FavoriteRank } from '@/types/database.types';
import { ACTION_COLORS } from '@/constants/actionColors';
import { cn } from '@/utils/cn';

import { CoverTile } from './CoverTile';

const RANKS: readonly FavoriteRank[] = [1, 2, 3, 4];

function TinyButton({
  label,
  a11y,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
  /** Fixed action colour for the glyph (e.g. red ✕ remove). */
  tone?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      className={cn('retrogamingpc-bevel h-5 flex-1 items-center justify-center bg-retrogamingpc-button', disabled && 'opacity-30')}
    >
      <Text className={cn('text-retrogamingpc-xs font-bold', !tone && 'text-retrogamingpc-text-bright')} style={tone ? { color: tone } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

type FavoritesShowcaseProps = { userId: string; editable: boolean };

/**
 * Top 4 all-time favorites. A filled slot opens the game's page; owners pick a
 * game for an empty slot, and reorder (◀ ▶), replace (⇄) or clear (✕) entries.
 */
export function FavoritesShowcase({ userId, editable }: FavoritesShowcaseProps) {
  const favorites = useFavorites(userId);
  const rows = favorites.data ?? [];
  const games = useGameLookup(rows.map((r) => r.game_id));
  const mutation = useFavoriteMutation();
  const [pickingRank, setPickingRank] = useState<FavoriteRank | null>(null);

  // Picking a game that is already ranked moves it (set_favorite RPC), so annotate rather than block.
  const annotations = new Map(rows.map((r) => [r.game_id, `Rank ${r.rank} — moves here`] as const));

  return (
    <RetroGamingPCPanel title="Top 4 Favorites">
      {favorites.isPending ? (
        <RetroGamingPCSpinner label="Loading favorites…" />
      ) : favorites.isError ? (
        <RetroGamingPCAlert message={favorites.error.message} />
      ) : !editable && rows.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No favorites picked yet.</Text>
      ) : (
        <View className="gap-2">
          {mutation.isError ? <RetroGamingPCAlert message={mutation.error.message} /> : null}
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
                  <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">#{rank}</Text>
                  {row ? (
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={`Favorite #${rank}: ${game?.name ?? 'game'}. Open game page`}
                      onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(row.game_id) } })}
                    >
                      {tile}
                    </Pressable>
                  ) : editable ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={`Pick favorite #${rank}`} onPress={() => setPickingRank(rank)}>
                      {tile}
                    </Pressable>
                  ) : (
                    tile
                  )}
                  <Text className="min-h-[14px] text-retrogamingpc-xs text-retrogamingpc-text-bright" numberOfLines={1}>
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
                      <TinyButton label="⇄" a11y={`Replace favorite #${rank}`} onPress={() => setPickingRank(rank)} />
                      <TinyButton label="✕" tone={ACTION_COLORS.cancel.text} a11y={`Remove favorite #${rank}`} onPress={() => mutation.mutate({ action: 'remove', rank })} />
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
    </RetroGamingPCPanel>
  );
}
