import { Text, View } from 'react-native';

import { SteamBadge, SteamButton, SteamCard } from '@/components/ui';
import type { CreatorResult } from '@/types/igdb';

import { Thumbnail } from './Thumbnail';

type CreatorResultCardProps = {
  creator: CreatorResult;
  /** Jump to the Games tab searching one of this person's titles. */
  onSearchGames: (title: string) => void;
};

export function CreatorResultCard({ creator, onSearchGames }: CreatorResultCardProps) {
  const firstTitle = creator.knownFor[0];

  return (
    <SteamCard className="flex-row gap-3">
      <Thumbnail
        uri={creator.imageUrl}
        fallback={creator.name}
        shape="square"
        accessibilityLabel={`${creator.name} photo`}
      />
      <View className="flex-1 gap-1">
        <View className="flex-row items-start gap-2">
          <Text className="flex-1 text-steam-base font-bold text-steam-text-bright" numberOfLines={1}>
            {creator.name}
          </Text>
          <Text className="font-mono text-steam-xs text-steam-text-muted">{creator.gamesCount} games</Text>
        </View>
        {creator.positions.length > 0 ? (
          <View className="flex-row flex-wrap gap-1">
            {creator.positions.slice(0, 3).map((role) => (
              <SteamBadge key={role} label={role} variant={role === 'director' ? 'main' : 'neutral'} />
            ))}
          </View>
        ) : null}
        {creator.knownFor.length > 0 ? (
          <Text className="text-steam-xs text-steam-text" numberOfLines={2}>
            Known for: {creator.knownFor.join(', ')}
          </Text>
        ) : null}
        {firstTitle ? (
          <View className="flex-row justify-end pt-1">
            <SteamButton label={`Find “${firstTitle}”`} onPress={() => onSearchGames(firstTitle)} />
          </View>
        ) : null}
      </View>
    </SteamCard>
  );
}
