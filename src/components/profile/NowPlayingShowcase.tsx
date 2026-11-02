import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { SteamAlert, SteamBadge, SteamPanel, SteamSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { NOW_PLAYING_SLOTS } from '@/services/nowPlaying';

import { CoverTile } from './CoverTile';

type NowPlayingShowcaseProps = {
  userId: string;
  /** Own profile: link to the Review Studio for editing. */
  isOwner: boolean;
};

/** Read-only public view of a player's 4 Now Playing slots. */
export function NowPlayingShowcase({ userId, isOwner }: NowPlayingShowcaseProps) {
  const nowPlaying = useNowPlaying(userId);
  const rows = nowPlaying.data ?? [];
  const games = useGameLookup(rows.map((r) => r.game_id));

  return (
    <SteamPanel
      title="Now Playing"
      headerRight={
        isOwner ? (
          <Link href="/post" className="text-steam-xs text-steam-highlight underline">
            Manage
          </Link>
        ) : undefined
      }
    >
      {nowPlaying.isPending ? (
        <SteamSpinner label="Loading…" />
      ) : nowPlaying.isError ? (
        <SteamAlert message={nowPlaying.error.message} />
      ) : rows.length === 0 ? (
        <Text className="text-steam-sm text-steam-text-muted">{isOwner ? 'Nothing in your Now Playing slots yet.' : 'Not playing anything right now.'}</Text>
      ) : (
        <View className="flex-row gap-2">
          {NOW_PLAYING_SLOTS.map((slot) => {
            const row = rows.find((r) => r.slot_index === slot);
            const game = row ? games.data?.get(row.game_id) : undefined;
            return (
              <View key={slot} className="flex-1 gap-1">
                <CoverTile game={game} gameId={row?.game_id ?? null} loading={games.isFetching} emptyLabel="—" />
                {row ? (
                  <>
                    <Text className="text-steam-xs font-bold text-steam-text-bright" numberOfLines={1}>
                      {game?.name ?? '…'}
                    </Text>
                    {row.preliminary_score !== null ? (
                      <SteamBadge label={`${row.preliminary_score}/10 so far`} variant="nowPlaying" />
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </SteamPanel>
  );
}
