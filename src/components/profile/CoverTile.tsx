import { Image, Text, View } from 'react-native';

import { SteamSpinner } from '@/components/ui';
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
    <View className={cn('steam-bevel-inset aspect-[3/4] items-center justify-center overflow-hidden bg-steam-dark', className)}>
      {gameId === null ? (
        <Text className="text-steam-xs text-steam-text-muted">{emptyLabel}</Text>
      ) : game?.coverImageId ? (
        <Image
          source={{ uri: igdbImageUrl(game.coverImageId, 'cover_big') }}
          className="h-full w-full"
          resizeMode="cover"
          accessibilityLabel={`${game.name} cover art`}
        />
      ) : loading ? (
        <SteamSpinner />
      ) : (
        <Text className="px-1 text-center text-steam-xs font-bold text-steam-text">{game?.name ?? `Game #${gameId}`}</Text>
      )}
    </View>
  );
}
