import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import type { NowPlaying, NowPlayingSlot } from '@/types/database.types';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';
import { slotRating } from '@/utils/ratingColumns';

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
    <View className={cn('retrogamingpc-bevel gap-1.5 bg-retrogamingpc-card p-1.5', selected && 'border-retrogamingpc-highlight')}>
      <View className="flex-row items-center justify-between">
        <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">SLOT {slot}</Text>
        {filled && row.preliminary_score === null ? <RetroGamingPCBadge label="Unrated" variant="draft" /> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filled ? `Swap ${title} in slot ${slot}` : `Add a game to slot ${slot}`}
        onPress={onAssign}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        className={cn(
          'aspect-[3/4] items-center justify-center overflow-hidden bg-retrogamingpc-dark',
          pressed ? 'retrogamingpc-bevel' : 'retrogamingpc-bevel-inset',
        )}
      >
        {!filled ? (
          <View className="items-center gap-1">
            <Text className="text-[32px] leading-[34px] text-retrogamingpc-highlight">+</Text>
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Add game</Text>
          </View>
        ) : game?.coverImageId ? (
          <Image
            source={{ uri: igdbImageUrl(game.coverImageId, 'cover_big') }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityLabel={`${title} cover art`}
          />
        ) : gameLoading ? (
          <RetroGamingPCSpinner />
        ) : (
          <Text className="px-2 text-center text-retrogamingpc-sm font-bold text-retrogamingpc-text">{title}</Text>
        )}
      </Pressable>

      {filled ? (
        <>
          <Text className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
            {title}
          </Text>
          {row.preliminary_score !== null ? <RetroGamingPCRating rating={slotRating(row)} size="compact" suffix="so far" /> : null}
          <Text className="min-h-[28px] text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={2}>
            {row.notes?.trim() ? row.notes : 'No running notes yet.'}
          </Text>
          <View className="flex-row flex-wrap gap-1">
            <RetroGamingPCButton label="Notes" onPress={onEdit} className="flex-1 px-1" />
            <RetroGamingPCButton label="Review" variant="primary" onPress={onReview} className="flex-1 px-1" />
          </View>
          <RetroGamingPCButton label="Remove" variant="danger" onPress={onRemove} className="px-1" />
        </>
      ) : null}
    </View>
  );
}
