import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCBadge, RetroGamingPCCard, RetroGamingPCRating } from '@/components/ui';
import type { ActivityFeedRow } from '@/types/database.types';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { reviewRating, slotRating } from '@/utils/ratingColumns';
import { timeAgo } from '@/utils/time';

type FeedItemCardProps = {
  item: ActivityFeedRow;
  game: IgdbGameResult | undefined;
  viewerId: string | null;
};

/**
 * One activity entry: avatar (→ profile) · "who did what" line · rating · excerpt · cover (→ game).
 * Reviews show stars; Now Playing entries show the preliminary score badge.
 */
export function FeedItemCard({ item, game, viewerId }: FeedItemCardProps) {
  const isMe = item.actor_id === viewerId;
  const gameName = game?.name ?? `Game #${item.game_id}`;
  const openActor = () => router.push(isMe ? '/profile' : { pathname: '/user/[id]', params: { id: item.actor_id } });
  const openGame = () => router.push({ pathname: '/game/[id]', params: { id: String(item.game_id) } });

  return (
    <RetroGamingPCCard className="flex-row gap-3">
      <Pressable accessibilityRole="link" accessibilityLabel={`Open ${item.actor_username}'s profile`} onPress={openActor}>
        <Thumbnail uri={item.actor_avatar_url} fallback={item.actor_username} shape="square" accessibilityLabel="" />
      </Pressable>

      <View className="flex-1 gap-1">
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
          <Text onPress={openActor} className="font-bold text-retrogamingpc-highlight">
            {isMe ? 'You' : item.actor_username}
          </Text>
          {item.kind === 'review' ? ' reviewed ' : ' is playing '}
          <Text onPress={openGame} className="font-bold text-retrogamingpc-text-bright">
            {gameName}
          </Text>
        </Text>

        {item.kind === 'review' ? (
          <RetroGamingPCRating rating={reviewRating(item)} size="compact" />
        ) : (
          <View className="flex-row flex-wrap gap-1">
            <RetroGamingPCBadge label={`Now Playing · Slot ${item.slot_index ?? '?'}`} variant="nowPlaying" />
            {item.preliminary_score !== null ? <RetroGamingPCRating rating={slotRating(item)} size="compact" suffix="so far" /> : null}
          </View>
        )}

        {item.excerpt ? (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={3}>
            {item.kind === 'now_playing' ? `Notes: ${item.excerpt}` : item.excerpt}
          </Text>
        ) : null}
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{timeAgo(item.occurred_at)}</Text>
      </View>

      <Pressable accessibilityRole="link" accessibilityLabel={`Open ${gameName}`} onPress={openGame}>
        <Thumbnail
          uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
          fallback={gameName}
          shape="cover"
          accessibilityLabel=""
        />
      </Pressable>
    </RetroGamingPCCard>
  );
}
