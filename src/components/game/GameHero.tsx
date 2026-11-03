import { Image, Text, View } from 'react-native';

import { CoverTile } from '@/components/profile/CoverTile';
import { QuickRating } from '@/components/rating/QuickRating';
import { RetroGamingPCBadge } from '@/components/ui';
import { usePrimaryRatingScale } from '@/hooks/useAuth';
import { PlayedOnControl } from '@/components/rating/PlayedOnControl';
import { useGameRatingControl, useMyGameRating } from '@/hooks/useRatings';
import { useMyReviewForGame } from '@/hooks/useReviews';
import type { GameReviewStats } from '@/services/games';
import { igdbImageUrl, type IgdbGameDetail } from '@/types/igdb';
import type { StoredRating } from '@/utils/rating';

import { EntryTypeBadge } from './EntryTypeBadge';
import { SCALE_DIVIDER, ScoreScales, TierScoreBox } from './ScoreScales';
import { WriteReviewButton } from './WriteReviewButton';

type GameHeroProps = { game: IgdbGameDetail; stats: GameReviewStats | undefined };

function firstRelease(game: IgdbGameDetail): string | null {
  return game.releaseDates.find((r) => r.date)?.human ?? game.releaseDates[0]?.human ?? (game.releaseYear ? String(game.releaseYear) : null);
}

/**
 * Store-page banner: dimmed artwork backdrop, cover, title block, badges, the
 * Gamer Cred score, your quick rating (always visible, one tap) and the
 * "Write a review" button.
 */
export function GameHero({ game, stats }: GameHeroProps) {
  const backdrop = game.artworkIds[0] ?? game.screenshotIds[0] ?? null;
  const release = firstRelease(game);
  const mine = useMyReviewForGame(game.id);
  const myRating = useMyGameRating(game.id);
  const control = useGameRatingControl(game, myRating.rating);
  const primaryScale = usePrimaryRatingScale();
  // Community average (canonical 1–100) shown like any rating, in the viewer's chosen scale.
  const community: StoredRating | null =
    stats && stats.count > 0 && stats.average !== null
      ? (() => {
          const numeric = Math.min(100, Math.max(1, Math.round(stats.average)));
          return { numeric, inputScale: 'numeric', input: String(numeric) };
        })()
      : null;

  return (
    <View className="retrogamingpc-window overflow-hidden">
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
          <Text role="heading" className="text-retrogamingpc-xl font-bold text-retrogamingpc-text-bright md:text-[24px] md:leading-[28px]">
            {game.name}
          </Text>
          {game.developers.length > 0 ? (
            <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
              <Text className="text-retrogamingpc-text-muted">Developer: </Text>
              {game.developers.join(', ')}
            </Text>
          ) : null}
          {game.publishers.length > 0 ? (
            <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
              <Text className="text-retrogamingpc-text-muted">Publisher: </Text>
              {game.publishers.join(', ')}
            </Text>
          ) : null}
          <EntryTypeBadge game={game} />
          {release ? (
            <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
              <Text className="text-retrogamingpc-text-muted">Release: </Text>
              {release}
            </Text>
          ) : null}
          <View className="flex-row flex-wrap gap-1 pt-1">
            {game.genres.slice(0, 4).map((g) => (
              <RetroGamingPCBadge key={g} label={g} variant="published" />
            ))}
            {game.platforms.slice(0, 6).map((p) => (
              <RetroGamingPCBadge key={p} label={p} />
            ))}
          </View>
          <View className="flex-row flex-wrap gap-3 pt-2">
            <TierScoreBox rating={community} title="Gamer Cred score">
              <Text className="retrogamingpc-label pb-0.5">Gamer Cred score · avg</Text>
              <ScoreScales
                rating={community}
                primaryScale={primaryScale}
                // The exact average (one decimal), not the rounded score used for tier / stars.
                numericText={community && stats?.average !== null && stats?.average !== undefined ? stats.average.toFixed(1) : undefined}
              />
              <Text className="border-t pt-1 text-retrogamingpc-xs text-retrogamingpc-text-muted" style={{ borderTopColor: SCALE_DIVIDER }}>
                {stats ? (stats.count > 0 ? `${stats.count} rating${stats.count === 1 ? '' : 's'}` : 'No ratings yet') : '…'}
              </Text>
            </TierScoreBox>
            <TierScoreBox rating={myRating.rating} title="Your rating">
              <Text className="retrogamingpc-label pb-1">Your rating</Text>
              {/* Your default scale, large and tappable; the other scales follow below. */}
              <QuickRating
                gameId={game.id}
                gameName={game.name}
                size="regular"
                showTierBadge={false}
                value={myRating.rating}
                readOnly={myRating.isPending}
                onChange={control.setRating}
              />
              <PlayedOnControl
                gameId={game.id}
                platformId={control.platformId}
                isDefault={control.isDefaultPlatform}
                defaultPlatformId={control.defaultPlatformId}
                disabled={myRating.isPending}
                onChange={control.setPlatform}
              />
              <ScoreScales rating={myRating.rating} primaryScale={primaryScale} omitPrimary dividerBeforeFirst className="mt-1" />
              <Text className="border-t pt-1 text-retrogamingpc-xs text-retrogamingpc-text-muted" style={{ borderTopColor: SCALE_DIVIDER }}>
                {myRating.rating
                  ? mine.data
                    ? 'Also the score on your review.'
                    : 'Public on your profile — counts toward your stats and the Gamer Cred score.'
                  : primaryScale === 'numeric'
                    ? 'Type a score and press Enter, or use − / +.'
                    : 'Tap to rate. Tap it again to clear.'}
              </Text>
            </TierScoreBox>
          </View>
          <View className="flex-row pt-1">
            <WriteReviewButton gameId={game.id} />
          </View>
        </View>
      </View>
    </View>
  );
}
