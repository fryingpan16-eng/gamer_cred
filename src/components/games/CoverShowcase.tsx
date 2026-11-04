import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { CoverTile } from '@/components/profile/CoverTile';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { ACTION_COLORS } from '@/constants/actionColors';

export const SHOWCASE_PREVIEW = 8;

type CoverShowcaseProps = {
  title: string;
  /** Newest first; only the first SHOWCASE_PREVIEW are shown. */
  gameIds: readonly number[] | undefined;
  isPending: boolean;
  error: Error | null;
  empty: ReactNode;
  headerRight?: ReactNode;
  /** Small text under a cover (e.g. "Now Playing"). */
  tagFor?: (gameId: number) => string | null;
  /** Owner tools: a ✕ on each cover. */
  onRemove?: (gameId: number, name: string) => void;
  footer?: ReactNode;
};

/** A panel of game covers (Liked Games, Backlog): tap a cover for the game page. */
export function CoverShowcase({ title, gameIds, isPending, error, empty, headerRight, tagFor, onRemove, footer }: CoverShowcaseProps) {
  const ids = (gameIds ?? []).slice(0, SHOWCASE_PREVIEW);
  const games = useGameLookup(ids);
  return (
    <RetroGamingPCPanel title={title} headerRight={headerRight}>
      {isPending ? (
        <RetroGamingPCSpinner label="Loading games…" />
      ) : error ? (
        <RetroGamingPCAlert message={error.message} />
      ) : ids.length === 0 ? (
        <View>{empty}</View>
      ) : (
        <View className="gap-2">
          <View className="flex-row flex-wrap gap-2">
            {ids.map((id) => {
              const game = games.data?.get(id);
              const name = game?.name ?? 'Game';
              const tag = tagFor?.(id) ?? null;
              return (
                <View key={id} className="w-[22%] min-w-[64px] flex-grow gap-0.5" style={{ maxWidth: 120 }}>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`${name}. Open game page`}
                    onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(id) } })}
                  >
                    <CoverTile game={game} gameId={id} loading={games.isPending} />
                  </Pressable>
                  {onRemove ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${name}`}
                      hitSlop={8}
                      onPress={() => onRemove(id, name)}
                      className="retrogamingpc-bevel absolute right-1 top-1 h-6 w-6 items-center justify-center bg-retrogamingpc-button"
                    >
                      <Text className="text-retrogamingpc-xs font-bold" style={{ color: ACTION_COLORS.cancel.text }}>
                        ✕
                      </Text>
                    </Pressable>
                  ) : null}
                  {tag ? <Text className="text-center text-retrogamingpc-xs text-retrogamingpc-text-bright">{tag}</Text> : null}
                </View>
              );
            })}
          </View>
          {footer}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
