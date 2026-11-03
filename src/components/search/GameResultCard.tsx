import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { QuickRating } from '@/components/rating/QuickRating';
import { RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCCard } from '@/components/ui';
import { useRateGame } from '@/hooks/useRatings';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import type { StoredRating } from '@/utils/rating';

import { EntryTypeBadge } from '@/components/game/EntryTypeBadge';

import { Thumbnail } from './Thumbnail';

type GameResultCardProps = {
  game: IgdbGameResult;
  /** The viewer's rating, from the list's single batched lookup (undefined while it loads). */
  myRating: StoredRating | null | undefined;
};

/** A game search result: inline quick rating (no navigation, no modal) + "View Details". */
export function GameResultCard({ game, myRating }: GameResultCardProps) {
  const { rate } = useRateGame();
  const meta = [game.releaseYear, game.developers[0]].filter(Boolean).join(' · ');

  return (
    <RetroGamingPCCard className="flex-row gap-3">
      <Thumbnail
        uri={game.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
        fallback={game.name}
        shape="cover"
        accessibilityLabel={`${game.name} cover art`}
      />
      <View className="flex-1 gap-1">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={2}>
            {game.name}
          </Text>
          {game.rating !== null ? (
            <View className="retrogamingpc-bevel-inset bg-retrogamingpc-dark px-1.5" accessibilityLabel={`Rating ${game.rating} out of 100`}>
              <Text className="font-mono text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright">{game.rating}</Text>
            </View>
          ) : null}
        </View>
        <EntryTypeBadge game={game} />
        {meta ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{meta}</Text> : null}
        <View className="flex-row flex-wrap gap-1">
          {game.platforms.slice(0, 4).map((p) => (
            <RetroGamingPCBadge key={p} label={p} />
          ))}
          {game.genres.slice(0, 2).map((g) => (
            <RetroGamingPCBadge key={g} label={g} variant="draft" />
          ))}
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-1 pt-1">
          <QuickRating
            gameId={game.id}
            gameName={game.name}
            value={myRating ?? null}
            readOnly={myRating === undefined}
            onChange={(next) => rate(game.id, next, myRating ?? null)}
          />
          <RetroGamingPCButton
            label="View Details"
            onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(game.id) } })}
          />
        </View>
      </View>
    </RetroGamingPCCard>
  );
}
