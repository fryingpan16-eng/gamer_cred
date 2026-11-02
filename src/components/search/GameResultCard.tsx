import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { SteamBadge, SteamButton, SteamCard } from '@/components/ui';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';

import { Thumbnail } from './Thumbnail';

export function GameResultCard({ game }: { game: IgdbGameResult }) {
  const meta = [game.releaseYear, game.developers[0]].filter(Boolean).join(' · ');

  return (
    <SteamCard className="flex-row gap-3">
      <Thumbnail
        uri={game.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
        fallback={game.name}
        shape="cover"
        accessibilityLabel={`${game.name} cover art`}
      />
      <View className="flex-1 gap-1">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-steam-base font-bold text-steam-text-bright" numberOfLines={2}>
            {game.name}
          </Text>
          {game.rating !== null ? (
            <View className="steam-bevel-inset bg-steam-dark px-1.5" accessibilityLabel={`Rating ${game.rating} out of 100`}>
              <Text className="font-mono text-steam-sm font-bold text-steam-highlight">{game.rating}</Text>
            </View>
          ) : null}
        </View>
        {meta ? <Text className="text-steam-xs text-steam-text-muted">{meta}</Text> : null}
        <View className="flex-row flex-wrap gap-1">
          {game.platforms.slice(0, 4).map((p) => (
            <SteamBadge key={p} label={p} />
          ))}
          {game.genres.slice(0, 2).map((g) => (
            <SteamBadge key={g} label={g} variant="draft" />
          ))}
        </View>
        <View className="flex-row justify-end pt-1">
          <SteamButton
            label="View Details"
            onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(game.id) } })}
          />
        </View>
      </View>
    </SteamCard>
  );
}
