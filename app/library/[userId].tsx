import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LibraryAddGamesButton } from '@/components/library/LibraryAddGamesButton';
import { LibraryChip } from '@/components/library/LibraryChip';
import { LibraryGameModal } from '@/components/library/LibraryGameModal';
import { LibraryPrivacyToggle } from '@/components/library/LibraryPrivacyToggle';
import { CoverTile } from '@/components/profile/CoverTile';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { generationGroup } from '@/constants/generations';
import { platformInfo } from '@/constants/platforms';
import { useGameLookup } from '@/hooks/useGames';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { useLibrary } from '@/hooks/useLibrary';
import { useProfile, useViewerId } from '@/hooks/useProfile';
import { useThemeColors } from '@/hooks/useTheme';
import { LIBRARY_MAX } from '@/services/library';
import type { IgdbGameResult } from '@/types/igdb';
import {
  filterLibrary,
  groupLibrary,
  libraryCounts,
  libraryGenerations,
  libraryPlatformIds,
  LIBRARY_FORMAT_LABELS,
  LIBRARY_SORT_LABELS,
  NO_LIBRARY_FILTERS,
  sortLibrary,
  type LibraryFilters,
  type LibraryFormat,
  type LibraryGame,
  type LibrarySort,
} from '@/utils/library';
import { shownName } from '@/utils/nameRules';
import { TOUCH_SLOP } from '@/utils/platform';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FORMATS: LibraryFormat[] = ['physical', 'digital'];
const SORTS: LibrarySort[] = ['added', 'title', 'year'];

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center gap-1" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="w-[72px] text-retrogamingpc-xs text-retrogamingpc-text-muted">{label}</Text>
      {children}
    </View>
  );
}

/**
 * A player's Library: the games they own, by platform. Filter by platform,
 * console generation (of the platform owned on), format and title; sort by
 * date added, title or release year. Each game shows the owner's rating.
 * Private Libraries are only for their owner.
 */
export default function LibraryScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const validId = typeof userId === 'string' && UUID_PATTERN.test(userId);
  const viewerId = useViewerId();
  const profile = useProfile(validId ? userId : null);
  const isOwner = validId && userId === viewerId;
  const hidden = !isOwner && profile.data?.library_visibility !== 'public';
  const library = useLibrary(validId && profile.data && !hidden ? userId : null);
  const isDesktop = useIsDesktop();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  const [filters, setFilters] = useState<LibraryFilters>(NO_LIBRARY_FILTERS);
  const [sort, setSort] = useState<LibrarySort>('added');
  const [editing, setEditing] = useState<IgdbGameResult | null>(null);
  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const entries = useMemo(() => library.data ?? [], [library.data]);
  const games = useMemo(() => groupLibrary(entries), [entries]);
  const lookup = useGameLookup(games.map((g) => g.gameId));
  const nameOf = (id: number) => lookup.data?.get(id)?.name ?? null;
  const shown = sortLibrary(filterLibrary(games, filters, nameOf), sort, nameOf);
  const counts = libraryCounts(entries);
  const platformIds = libraryPlatformIds(entries);
  const generations = libraryGenerations(entries);
  const filtering = filters.platformId !== null || filters.generation !== null || filters.format !== null || filters.query.trim() !== '';

  const name = profile.data ? shownName(profile.data.username, profile.data.display_name) : null;
  const title = isOwner ? 'Your Library' : name ? `${name}’s Library` : 'Library';
  const columns = isDesktop ? 5 : 3;

  if (!validId) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title }} />
        <RetroGamingPCAlert message="This player doesn't exist." />
      </View>
    );
  }
  if (profile.isPending || (!hidden && library.isPending)) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark">
        <Stack.Screen options={{ title }} />
        <RetroGamingPCSpinner label="Loading library…" className="p-3" />
      </View>
    );
  }
  if (hidden) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title }} />
        <RetroGamingPCAlert tone="info" message="This library is private." />
      </View>
    );
  }
  if (library.error) {
    return (
      <View className="flex-1 gap-2 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title }} />
        <RetroGamingPCAlert message={library.error.message} />
        <View className="flex-row justify-end">
          <RetroGamingPCButton label="Retry" onPress={() => void library.refetch()} />
        </View>
      </View>
    );
  }

  const header = (
    <View className="gap-2 pb-1">
      {isOwner ? (
        <View className="gap-2 md:flex-row md:items-start md:justify-between">
          <LibraryPrivacyToggle />
          <View className="flex-row justify-end">
            <LibraryAddGamesButton />
          </View>
        </View>
      ) : null}
      <RetroGamingPCInput
        placeholder="Search by title"
        value={filters.query}
        onChangeText={(q) => set('query', q)}
        accessibilityLabel="Search your library by title"
        icon={<Feather name="search" size={12} color={themeColors.textMuted} />}
      />
      {platformIds.length > 1 ? (
        <FilterRow label="Platform">
          <LibraryChip label="All" selected={filters.platformId === null} onPress={() => set('platformId', null)} />
          {platformIds.map((id) => (
            <LibraryChip
              key={id}
              label={platformInfo(id).short}
              accessibilityLabel={platformInfo(id).name}
              selected={filters.platformId === id}
              onPress={() => set('platformId', filters.platformId === id ? null : id)}
            />
          ))}
        </FilterRow>
      ) : null}
      {generations.length > 0 ? (
        <FilterRow label="Generation">
          <LibraryChip label="All" selected={filters.generation === null} onPress={() => set('generation', null)} />
          {generations.map((key) => {
            const group = generationGroup(key);
            return (
              <LibraryChip
                key={key}
                label={group?.short ?? key}
                accessibilityLabel={group?.label ?? key}
                selected={filters.generation === key}
                onPress={() => set('generation', filters.generation === key ? null : key)}
              />
            );
          })}
        </FilterRow>
      ) : null}
      <FilterRow label="Format">
        <LibraryChip label="All" selected={filters.format === null} onPress={() => set('format', null)} />
        {FORMATS.map((f) => (
          <LibraryChip key={f} label={LIBRARY_FORMAT_LABELS[f]} selected={filters.format === f} onPress={() => set('format', filters.format === f ? null : f)} />
        ))}
      </FilterRow>
      <FilterRow label="Sort">
        {SORTS.map((s) => (
          <LibraryChip key={s} label={LIBRARY_SORT_LABELS[s]} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </FilterRow>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          {filtering ? `${shown.length} of ` : ''}
          {counts.games} game{counts.games === 1 ? '' : 's'}
          {counts.copies > counts.games ? ` · ${counts.copies} copies` : ''}
          {counts.copies >= LIBRARY_MAX ? ` (showing the latest ${LIBRARY_MAX} copies)` : ''}
        </Text>
        {filtering ? (
          <Pressable accessibilityRole="button" hitSlop={TOUCH_SLOP} onPress={() => setFilters(NO_LIBRARY_FILTERS)}>
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderGame = (item: LibraryGame) => {
    const game = lookup.data?.get(item.gameId);
    const gameName = item.name ?? game?.name ?? 'Game';
    const platforms = item.copies
      .map((c) => `${platformInfo(c.platformId).short}${c.format ? ` (${LIBRARY_FORMAT_LABELS[c.format].toLowerCase()})` : ''}`)
      .join(', ');
    return (
      <View className="flex-1 gap-1" style={{ maxWidth: `${100 / columns}%` }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${gameName}, on ${platforms}. Open game page`}
          onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(item.gameId) } })}
          className="gap-1"
        >
          <CoverTile game={game} gameId={item.gameId} loading={lookup.isPending} />
          <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text" numberOfLines={2}>
            {gameName}
          </Text>
        </Pressable>
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={2}>
          {platforms}
        </Text>
        {item.rating ? <RetroGamingPCRating rating={item.rating} size="compact" /> : null}
        {isOwner && game ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Change platforms for ${gameName}`} hitSlop={TOUCH_SLOP} onPress={() => setEditing(game)}>
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">Edit</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title }} />
      <FlatList
        key={columns}
        data={shown}
        keyExtractor={(g) => String(g.gameId)}
        numColumns={columns}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-3 p-3 md:max-w-[960px] md:w-full md:self-center"
        contentContainerStyle={{ paddingBottom: 12 + insets.bottom }}
        columnWrapperClassName="gap-2"
        ListHeaderComponent={header}
        renderItem={({ item }) => renderGame(item)}
        ListEmptyComponent={
          <RetroGamingPCAlert
            tone="info"
            message={
              filtering
                ? 'No games match these filters.'
                : isOwner
                  ? 'Your Library is empty. Tap + Add games, or use + Library on any game page or search result.'
                  : 'Nothing in this library yet.'
            }
          />
        }
      />
      {editing ? <LibraryGameModal game={editing} visible onClose={() => setEditing(null)} /> : null}
    </View>
  );
}
