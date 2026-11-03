import { Image, Text, View } from 'react-native';

import { RetroGamingPCSpinner } from '@/components/ui';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';

type CoverTileProps = {
  game: IgdbGameResult | undefined;
  gameId: number | null;
  loading?: boolean;
  /** Text for an empty tile. */
  emptyLabel?: string;
  className?: string;
};

/** Sunken 3:4 cover frame with title fallback — shared by favorites and Now Playing views. */
export function CoverTile({ game, gameId, loading = false, emptyLabel = 'Empty', className }: CoverTileProps) {
  return (
    <View className={cn('retrogamingpc-bevel-inset aspect-[3/4] items-center justify-center overflow-hidden bg-retrogamingpc-dark', className)}>
      {gameId === null ? (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{emptyLabel}</Text>
      ) : game?.coverImageId ? (
        <Image
          source={{ uri: igdbImageUrl(game.coverImageId, 'cover_big') }}
          className="h-full w-full"
          resizeMode="cover"
          accessibilityLabel={`${game.name} cover art`}
        />
      ) : loading ? (
        <RetroGamingPCSpinner />
      ) : (
        <Text className="px-1 text-center text-retrogamingpc-xs font-bold text-retrogamingpc-text">{game?.name ?? `Game #${gameId}`}</Text>
      )}
    </View>
  );
}
