import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { FlatList, Text, View } from 'react-native';

import { SteamAlert, SteamButton, SteamCard, SteamSpinner } from '@/components/ui';

type SearchResultListProps<T> = {
  /** Query state (any payload shape); `items` carries the extracted rows. */
  query: Pick<UseQueryResult<unknown>, 'error' | 'isError' | 'isFetching' | 'isPlaceholderData' | 'refetch'>;
  items: T[] | undefined;
  /** Debounced term the query ran with. */
  term: string;
  /** Whether `term` is long enough to search. */
  active: boolean;
  /** True while the user is still typing (term not yet debounced). */
  typing: boolean;
  idleHint: string;
  loadingLabel: string;
  keyExtractor: (item: T) => string;
  renderItem: (item: T) => ReactElement;
  /** Optional status suffix, e.g. "cached". */
  statusNote?: string;
  /** Rendered beneath the results (e.g. data-provider attribution). */
  footer?: ReactElement;
};

function SkeletonCard() {
  return (
    <SteamCard className="flex-row gap-3 opacity-60">
      <View className="steam-bevel-inset h-16 w-12 bg-steam-dark" />
      <View className="flex-1 gap-2 py-1">
        <View className="h-3 w-2/3 bg-steam-panel" />
        <View className="h-2 w-1/3 bg-steam-panel" />
        <View className="h-2 w-1/2 bg-steam-panel" />
      </View>
    </SteamCard>
  );
}

function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View className="steam-bevel-inset items-center gap-1 bg-steam-dark px-4 py-6">
      <Text className="text-steam-base font-bold text-steam-text">{title}</Text>
      {body ? <Text className="text-center text-steam-sm text-steam-text-muted">{body}</Text> : null}
    </View>
  );
}

/**
 * Shared search-results renderer: idle prompt → skeleton → results / empty / error.
 * Previous results stay visible (dimmed) while a new term loads, so the list never jumps.
 */
export function SearchResultList<T>({
  query,
  items: data,
  term,
  active,
  typing,
  idleHint,
  loadingLabel,
  keyExtractor,
  renderItem,
  statusNote,
  footer,
}: SearchResultListProps<T>) {
  if (!active) {
    return (
      <View className="p-3">
        <EmptyState title="Start typing to search" body={idleHint} />
      </View>
    );
  }

  const { error, isError, isFetching, isPlaceholderData, refetch } = query;

  if (!data) {
    if (isError) {
      return (
        <View className="gap-2 p-3">
          <SteamAlert message={error?.message ?? 'Search failed.'} />
          <View className="flex-row justify-end">
            <SteamButton label="Retry" onPress={() => void refetch()} />
          </View>
        </View>
      );
    }
    return (
      <View className="gap-2 p-3">
        <SteamSpinner label={loadingLabel} />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  const refreshing = typing || isFetching;

  return (
    <FlatList
      data={data}
      keyExtractor={keyExtractor}
      renderItem={({ item }) => renderItem(item)}
      className={isPlaceholderData ? 'opacity-60' : undefined}
      contentContainerClassName="gap-2 p-3"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View className="gap-2">
          {isError ? <SteamAlert message={`Showing previous results — ${error?.message ?? 'refresh failed'}`} /> : null}
          <View className="h-4 flex-row items-center justify-between">
            <Text className="steam-label">
              {data.length} result{data.length === 1 ? '' : 's'} for “{term.trim()}”{statusNote ? ` · ${statusNote}` : ''}
            </Text>
            {refreshing ? <SteamSpinner /> : null}
          </View>
        </View>
      }
      ListFooterComponent={footer}
      ListEmptyComponent={
        <EmptyState title={`No matches for “${term.trim()}”`} body="Check the spelling or try a shorter search." />
      }
    />
  );
}
