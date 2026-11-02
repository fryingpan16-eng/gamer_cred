import { Image, Text, View } from 'react-native';

import { CoverTile } from '@/components/profile/CoverTile';
import { SteamBadge } from '@/components/ui';
import type { GameReviewStats } from '@/services/games';
import { igdbImageUrl, type IgdbGameDetail } from '@/types/igdb';

import { ScoreBox } from './ScoreBox';

type GameHeroProps = { game: IgdbGameDetail; stats: GameReviewStats | undefined };

function firstRelease(game: IgdbGameDetail): string | null {
  return game.releaseDates.find((r) => r.date)?.human ?? game.releaseDates[0]?.human ?? (game.releaseYear ? String(game.releaseYear) : null);
}

/** Store-page banner: dimmed artwork backdrop, cover, title block, badges and score boxes. */
export function GameHero({ game, stats }: GameHeroProps) {
  const backdrop = game.artworkIds[0] ?? game.screenshotIds[0] ?? null;
  const release = firstRelease(game);
  const community = stats && stats.count > 0 && stats.average !== null ? Math.round(stats.average * 10) : null;

  return (
    <View className="steam-window overflow-hidden">
      {backdrop ? (
        <Image
          source={{ uri: igdbImageUrl(backdrop, 'screenshot_med') }}
          className="absolute inset-0 h-full w-full opacity-25"
          resizeMode="cover"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      <View className="flex-row gap-3 p-3 md:gap-4 md:p-4">
        <View className="w-28 md:w-40">
          <CoverTile game={game} gameId={game.id} />
        </View>
        <View className="flex-1 gap-1.5">
          <Text role="heading" className="text-steam-xl font-bold text-steam-text-bright md:text-[24px] md:leading-[28px]">
            {game.name}
          </Text>
          {game.developers.length > 0 ? (
            <Text className="text-steam-sm text-steam-text">
              <Text className="text-steam-text-muted">Developer: </Text>
              {game.developers.join(', ')}
            </Text>
          ) : null}
          {game.publishers.length > 0 ? (
            <Text className="text-steam-sm text-steam-text">
              <Text className="text-steam-text-muted">Publisher: </Text>
              {game.publishers.join(', ')}
            </Text>
          ) : null}
          {release ? (
            <Text className="text-steam-sm text-steam-text">
              <Text className="text-steam-text-muted">Release: </Text>
              {release}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-1 pt-1">
            {game.genres.slice(0, 4).map((g) => (
              <SteamBadge key={g} label={g} variant="published" />
            ))}
            {game.platforms.slice(0, 6).map((p) => (
              <SteamBadge key={p} label={p} />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-3 pt-2">
            <ScoreBox label="Critics" score={game.criticRating} caption={game.criticRatingCount ? `${game.criticRatingCount} reviews` : undefined} />
            <ScoreBox label="IGDB users" score={game.userRating} caption={game.userRatingCount ? `${game.userRatingCount} votes` : undefined} />
            <ScoreBox label="Gamer Cred" score={community} caption={stats ? `${stats.count} review${stats.count === 1 ? '' : 's'}` : undefined} />
          </View>
        </View>
      </View>
    </View>
  );
}
