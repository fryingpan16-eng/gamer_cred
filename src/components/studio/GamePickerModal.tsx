import { Feather } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCModal, RetroGamingPCSpinner } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { primeGameCache } from '@/hooks/useGames';
import { useGameSearch } from '@/hooks/useSearch';
import { ENTRY_TYPE_LABELS, IGDB_SEARCH_LIMITS, igdbImageUrl, normalizeSearchQuery, type IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';
import { useThemeColors } from '@/hooks/useTheme';

type GamePickerModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (game: IgdbGameResult) => void;
  /** Games that cannot be picked, with the reason shown (e.g. "In slot 2"). */
  unavailable?: ReadonlyMap<number, string>;
  /** Informational badges that do NOT block picking (e.g. "Rank 2 — moves here"). */
  annotations?: ReadonlyMap<number, string>;
  /** Shown as a badge on the current game when swapping. */
  currentGameId?: number | null;
};

/** Search-and-pick dialog used for Now Playing slots, favourites and reviews. */
export function GamePickerModal({ visible, title, onClose, ...bodyProps }: GamePickerModalProps) {
  return (
    <RetroGamingPCModal
      visible={visible}
      title={title}
      onClose={onClose}
      className="max-w-[520px]"
      footer={<RetroGamingPCButton label="Cancel" onPress={onClose} />}
    >
      {/* Mounted only while open, so every opening starts with an empty search box. */}
      {visible ? <PickerBody {...bodyProps} /> : null}
    </RetroGamingPCModal>
  );
}

function PickerBody({
  onPick,
  unavailable,
  annotations,
  currentGameId,
}: Pick<GamePickerModalProps, 'onPick' | 'unavailable' | 'annotations' | 'currentGameId'>) {
  const themeColors = useThemeColors();
  const queryClient = useQueryClient();
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 350);
  const search = useGameSearch(debounced);
  const active = normalizeSearchQuery(debounced).length >= IGDB_SEARCH_LIMITS.minQueryLength;

  const pick = (game: IgdbGameResult) => {
    primeGameCache(queryClient, [game]); // slot renders instantly, no lookup round-trip
    onPick(game);
  };

  return (
    <View className="gap-2">
      <RetroGamingPCInput
        value={term}
        onChangeText={setTerm}
        placeholder="Search games by title…"
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel="Search games"
        icon={<Feather name="search" size={12} color={themeColors.textMuted} />}
        trailing={search.isFetching ? <RetroGamingPCSpinner /> : null}
      />

      <View className="h-[320px]">
        {!active ? (
          <Text className="py-6 text-center text-retrogamingpc-sm text-retrogamingpc-text-muted">
            Type at least {IGDB_SEARCH_LIMITS.minQueryLength} characters to search IGDB.
          </Text>
        ) : search.isError && !search.data ? (
          <View className="gap-2 pt-2">
            <RetroGamingPCAlert message={search.error.message} />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void search.refetch()} />
            </View>
          </View>
        ) : !search.data ? (
          <RetroGamingPCSpinner label="Searching IGDB…" className="justify-center py-6" />
        ) : (
          <FlatList
            data={search.data.results}
            keyExtractor={(g) => String(g.id)}
            keyboardShouldPersistTaps="handled"
            className={search.isPlaceholderData ? 'opacity-60' : undefined}
            contentContainerClassName="gap-1"
            ListEmptyComponent={
              <Text className="py-6 text-center text-retrogamingpc-sm text-retrogamingpc-text-muted">No games match “{debounced}”.</Text>
            }
            renderItem={({ item }) => {
              const blockedReason = unavailable?.get(item.id);
              const isCurrent = currentGameId === item.id;
              const note = annotations?.get(item.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: Boolean(blockedReason) }}
                  accessibilityLabel={`Choose ${item.name}`}
                  disabled={Boolean(blockedReason)}
                  onPress={() => pick(item)}
                  className={cn(
                    'flex-row items-center gap-2 border border-retrogamingpc-accent bg-retrogamingpc-card p-1.5',
                    blockedReason && 'opacity-50',
                  )}
                >
                  {({ pressed }) => (
                    <>
                      <Thumbnail
                        uri={item.coverImageId ? igdbImageUrl(item.coverImageId, 'cover_small') : null}
                        fallback={item.name}
                        shape="cover"
                        accessibilityLabel={`${item.name} cover`}
                      />
                      <View className={cn('flex-1 gap-0.5', pressed && 'opacity-70')}>
                        <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={1}>
                          {[item.releaseYear, item.platforms.slice(0, 3).join(' / ')].filter(Boolean).join(' · ')}
                        </Text>
                        <View className="flex-row gap-1">
                          {item.entryType && item.entryType !== 'game' ? (
                            <RetroGamingPCBadge
                              label={
                                item.parentGame
                                  ? `${ENTRY_TYPE_LABELS[item.entryType]} · ${item.parentGame.name}`
                                  : item.entryType === 'collection' && (item.collectionGames?.length ?? 0) > 0
                                    ? `Collection · ${item.collectionGames.length} games`
                                    : ENTRY_TYPE_LABELS[item.entryType]
                              }
                              variant="draft"
                            />
                          ) : null}
                          {isCurrent ? <RetroGamingPCBadge label="Current" variant="nowPlaying" /> : null}
                          {blockedReason ? <RetroGamingPCBadge label={blockedReason} variant="draft" /> : null}
                          {note && !isCurrent ? <RetroGamingPCBadge label={note} /> : null}
                        </View>
                      </View>
                    </>
                  )}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </View>
  );
}
