import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { SteamBadge, SteamButton, SteamScoreMeter, SteamSpinner } from '@/components/ui';
import type { NowPlaying, NowPlayingSlot } from '@/types/database.types';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';

type NowPlayingSlotCardProps = {
  slot: NowPlayingSlot;
  row: NowPlaying | undefined;
  game: IgdbGameResult | undefined;
  gameLoading: boolean;
  selected: boolean;
  onAssign: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onReview: () => void;
};

/**
 * One Now Playing slot. Empty: big "+" target. Filled: cover, title, score
 * badge, notes snippet. Tapping the cover opens the picker to swap the game.
 */
export function NowPlayingSlotCard({
  slot,
  row,
  game,
  gameLoading,
  selected,
  onAssign,
  onEdit,
  onRemove,
  onReview,
}: NowPlayingSlotCardProps) {
  const [pressed, setPressed] = useState(false);
  const filled = row !== undefined;
  const title = game?.name ?? (gameLoading ? 'Loading…' : `Game #${row?.game_id ?? ''}`);

  return (
    <View className={cn('steam-bevel gap-1.5 bg-steam-card p-1.5', selected && 'border-steam-highlight')}>
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-steam-xs text-steam-text-muted">SLOT {slot}</Text>
        {filled && row.preliminary_score !== null ? (
          <SteamBadge label={`${row.preliminary_score}/10`} variant="nowPlaying" />
        ) : filled ? (
          <SteamBadge label="Unscored" variant="draft" />
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filled ? `Swap ${title} in slot ${slot}` : `Add a game to slot ${slot}`}
        onPress={onAssign}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        className={cn(
          'aspect-[3/4] items-center justify-center overflow-hidden bg-steam-dark',
          pressed ? 'steam-bevel' : 'steam-bevel-inset',
        )}
      >
        {!filled ? (
          <View className="items-center gap-1">
            <Text className="text-[32px] leading-[34px] text-steam-highlight">+</Text>
            <Text className="text-steam-xs text-steam-text-muted">Add game</Text>
          </View>
        ) : game?.coverImageId ? (
          <Image
            source={{ uri: igdbImageUrl(game.coverImageId, 'cover_big') }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityLabel={`${title} cover art`}
          />
        ) : gameLoading ? (
          <SteamSpinner />
        ) : (
          <Text className="px-2 text-center text-steam-sm font-bold text-steam-text">{title}</Text>
        )}
      </Pressable>

      {filled ? (
        <>
          <Text className="text-steam-sm font-bold text-steam-text-bright" numberOfLines={1}>
            {title}
          </Text>
          <SteamScoreMeter value={row.preliminary_score} size="compact" />
          <Text className="min-h-[28px] text-steam-xs text-steam-text-muted" numberOfLines={2}>
            {row.notes?.trim() ? row.notes : 'No running notes yet.'}
          </Text>
          <View className="flex-row flex-wrap gap-1">
            <SteamButton label="Notes" onPress={onEdit} className="flex-1 px-1" />
            <SteamButton label="Review" variant="primary" onPress={onReview} className="flex-1 px-1" />
          </View>
          <SteamButton label="Remove" variant="danger" onPress={onRemove} className="px-1" />
        </>
      ) : null}
    </View>
  );
}
