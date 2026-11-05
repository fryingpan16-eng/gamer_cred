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

/** "Also remastered · 2011, 2018" for result cards, or null. Remasters share the original's page. */
export function remasterLine(game: Pick<IgdbGameResult, 'remasterCount' | 'remasterYears'>): string | null {
  const count = game.remasterCount ?? 0;
  if (count === 0) return null;
  const years = game.remasterYears ?? [];
  const shown = years.length > 3 ? `${years.slice(0, 3).join(', ')} +${years.length - 3}` : years.join(', ');
  return shown ? `Also remastered · ${shown}` : count > 1 ? `Also remastered (${count} versions)` : 'Also remastered';
}

/** "Also: Director's Cut" for result cards, or null. Other versions share the game's page. */
export function versionLine(game: Pick<IgdbGameResult, 'versionNames'>): string | null {
  const names = game.versionNames ?? [];
  return names.length > 0 ? `Also: ${names.join(', ')}` : null;
}

/**
 * A game in a list of results (search, studio pages): cover, title, year, studios, platforms.
 * The whole card opens the game page; rating happens there, not in lists.
 */
export function GameResultCard({ game, note }: GameResultCardProps) {
  const meta = gameMetaLine(game);
  const extraPlatforms = game.platforms.length - MAX_PLATFORMS;
  const remastered = remasterLine(game);
  const versions = versionLine(game);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${game.name}${meta ? `, ${meta}` : ''}${remastered ? `. ${remastered}` : ''}${versions ? `. ${versions}` : ''}. Open game page`}
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
            {remastered ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text">↻ {remastered}</Text> : null}
            {versions ? (
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={1}>
                + {versions}
              </Text>
            ) : null}
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
