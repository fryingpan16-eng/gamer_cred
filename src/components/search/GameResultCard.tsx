import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { EntryTypeBadge } from '@/components/game/EntryTypeBadge';
import { RetroGamingPCBadge, RetroGamingPCCard } from '@/components/ui';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';

import { Thumbnail } from './Thumbnail';

const MAX_PLATFORMS = 6;

type GameResultCardProps = {
  game: IgdbGameResult;
  /** Optional line under the card content, e.g. "Developed + Published" on studio pages. */
  note?: string;
};

/** "2019 · Kojima Productions" style line: release year, then every developer. */
export function gameMetaLine(game: Pick<IgdbGameResult, 'releaseYear' | 'developers'>): string {
  return [game.releaseYear, game.developers.join(', ')].filter(Boolean).join(' · ');
}

/**
 * A game in a list of results (search, studio pages): cover, title, year, studios, platforms.
 * The whole card opens the game page; rating happens there, not in lists.
 */
export function GameResultCard({ game, note }: GameResultCardProps) {
  const meta = gameMetaLine(game);
  const extraPlatforms = game.platforms.length - MAX_PLATFORMS;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${game.name}${meta ? `, ${meta}` : ''}. Open game page`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(game.id) } })}
    >
      {({ pressed }) => (
        <RetroGamingPCCard className={pressed ? 'flex-row gap-3 opacity-80' : 'flex-row gap-3'}>
          <Thumbnail
            uri={game.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
            fallback={game.name}
            shape="cover"
            accessibilityLabel=""
          />
          <View className="flex-1 gap-1">
            <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={2}>
              {game.name}
            </Text>
            <EntryTypeBadge game={game} />
            {meta ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{meta}</Text> : null}
            {game.platforms.length > 0 ? (
              <View className="flex-row flex-wrap gap-1">
                {game.platforms.slice(0, MAX_PLATFORMS).map((p) => (
                  <RetroGamingPCBadge key={p} label={p} />
                ))}
                {extraPlatforms > 0 ? <RetroGamingPCBadge label={`+${extraPlatforms}`} /> : null}
              </View>
            ) : null}
            {note ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{note}</Text> : null}
          </View>
        </RetroGamingPCCard>
      )}
    </Pressable>
  );
}
