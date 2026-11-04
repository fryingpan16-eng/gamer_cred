import { router } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';

import { RetroGamingPCBadge } from '@/components/ui';
import { useShownName } from '@/components/user/UserName';
import { useGameLookup } from '@/hooks/useGames';
import type { ListSummary } from '@/services/lists';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';

/** 2×2 cover mosaic of a list's first games (empty cells stay sunken). */
export function ListMosaic({
  gameIds,
  games,
  size,
}: {
  gameIds: readonly number[];
  games: ReadonlyMap<number, IgdbGameResult> | undefined;
  size: number;
}) {
  const cell = size / 2;
  return (
    <View
      className="retrogamingpc-bevel-inset flex-row flex-wrap overflow-hidden bg-retrogamingpc-dark"
      style={{ width: size + 2, height: (size / 3) * 4 + 2 }}
    >
      {[0, 1, 2, 3].map((i) => {
        const id = gameIds[i];
        const cover = id !== undefined ? games?.get(id)?.coverImageId : null;
        return (
          <View key={i} style={{ width: cell, height: (cell / 3) * 4 }} className="border border-retrogamingpc-dark bg-retrogamingpc-panel">
            {cover ? (
              <Image
                source={{ uri: igdbImageUrl(cover, 'cover_small', true) }}
                className="h-full w-full"
                resizeMode="cover"
                accessibilityElementsHidden
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

type ListCardProps = {
  list: ListSummary;
  games: ReadonlyMap<number, IgdbGameResult> | undefined;
  /** 'tile' for horizontal strips (Home), 'row' for search results / profiles. */
  layout?: 'tile' | 'row';
  showOwner?: boolean;
};

/** A list preview: cover mosaic, title, owner, game count and badges. Tap to open. */
export function ListCard(props: ListCardProps) {
  // Smart lists' count and covers come with the summary (smart_list_previews), like hand-picked ones.
  return <ListCardBody {...props} gameCount={props.list.gameCount} previewGameIds={props.list.previewGameIds} />;
}

function ListCardBody({
  list,
  games,
  layout = 'row',
  showOwner = true,
  gameCount,
  previewGameIds,
}: ListCardProps & { gameCount: number | null; previewGameIds: readonly number[] }) {
  const tile = layout === 'tile';
  const countText = gameCount === null ? 'Loading…' : `${gameCount} game${gameCount === 1 ? '' : 's'}`;
  const ownerName = useShownName(list.owner?.id, list.owner?.username ?? '').name;
  const meta = [showOwner && list.owner ? `by ${ownerName}` : null, countText].filter(Boolean).join(' · ');
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`List: ${list.title}, ${meta}. Open list`}
      onPress={() => router.push({ pathname: '/list/[id]', params: { id: list.id } })}
      className={cn('retrogamingpc-bevel bg-retrogamingpc-card p-2', tile ? 'w-[168px] gap-1.5' : 'flex-row gap-3')}
    >
      <ListMosaic gameIds={previewGameIds} games={games} size={tile ? 150 : 72} />
      <View className={cn('gap-1', !tile && 'flex-1')}>
        <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={2}>
          {list.title}
        </Text>
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={1}>
          {meta}
        </Text>
        {!tile && list.description ? (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={2}>
            {list.description}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-1">
          {list.pinnedRank !== null ? <RetroGamingPCBadge label="Featured" variant="main" /> : null}
          {list.smartRule ? <RetroGamingPCBadge label="Auto-updated" variant="published" /> : null}
          {list.isRanked && !list.smartRule ? <RetroGamingPCBadge label="Ranked" variant="nowPlaying" /> : null}
          {!list.isPublic ? <RetroGamingPCBadge label="Private" variant="neutral" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Several list cards with ONE cover lookup for all their previews. */
export function ListCards({
  lists,
  layout = 'row',
  showOwner = true,
}: {
  lists: readonly ListSummary[];
  layout?: 'tile' | 'row';
  showOwner?: boolean;
}) {
  const games = useGameLookup(lists.flatMap((l) => l.previewGameIds));
  return (
    <View className={layout === 'tile' ? 'flex-row gap-2' : 'gap-2'}>
      {lists.map((l) => (
        <ListCard key={l.id} list={l} games={games.data} layout={layout} showOwner={showOwner} />
      ))}
    </View>
  );
}
