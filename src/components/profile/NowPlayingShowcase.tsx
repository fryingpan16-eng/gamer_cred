import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCBadge, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useFriendRelation } from '@/hooks/useProfile';
import { NOW_PLAYING_VISIBILITY_OPTIONS, type NowPlayingVisibility } from '@/constants/privacy';
import { NOW_PLAYING_SLOTS } from '@/services/nowPlaying';
import { nowPlayingHiddenReason } from '@/utils/privacy';
import { slotRating } from '@/utils/ratingColumns';

import { CoverTile } from './CoverTile';

type NowPlayingShowcaseProps = {
  userId: string;
  /** Own profile: link to the Review Studio for editing. */
  isOwner: boolean;
  /** The player's Now Playing visibility. RLS already withholds rows from viewers who aren't allowed. */
  visibility: NowPlayingVisibility;
};

/** Read-only public view of a player's 4 Now Playing slots. */
export function NowPlayingShowcase({ userId, isOwner, visibility }: NowPlayingShowcaseProps) {
  // Same query (and cache) as the FriendButton; only needed for friends-only visibility.
  const relation = useFriendRelation(!isOwner && visibility === 'friends' ? userId : null);
  const checkingFriendship = !isOwner && visibility === 'friends' && relation.isPending;
  const hiddenReason = nowPlayingHiddenReason(visibility, {
    isOwner,
    isFriend: relation.data?.state === 'friends',
  });
  const nowPlaying = useNowPlaying(userId);
  const rows = nowPlaying.data ?? [];
  const games = useGameLookup(rows.map((r) => r.game_id));

  return (
    <RetroGamingPCPanel
      title="Now Playing"
      headerRight={
        isOwner ? (
          <View className="flex-row items-center gap-2">
            {visibility !== 'public' ? (
              <RetroGamingPCBadge label={NOW_PLAYING_VISIBILITY_OPTIONS[visibility].badge} variant="draft" />
            ) : null}
            <Link href="/post" className="text-retrogamingpc-xs text-retrogamingpc-highlight underline">
              Manage
            </Link>
          </View>
        ) : undefined
      }
    >
      {isOwner && visibility !== 'public' ? (
        <Text className="pb-2 text-retrogamingpc-xs text-retrogamingpc-text-muted">
          {visibility === 'friends' ? 'Only your friends can see this.' : 'Only you can see this.'} Change it in{' '}
          <Link href="/settings" className="text-retrogamingpc-highlight underline">
            Settings
          </Link>
          .
        </Text>
      ) : null}
      {checkingFriendship ? (
        <RetroGamingPCSpinner label="Loading…" />
      ) : hiddenReason === 'private' ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">🔒 This player keeps their Now Playing private.</Text>
      ) : hiddenReason === 'friends' ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          👥 This player only shares their Now Playing with friends.
        </Text>
      ) : nowPlaying.isPending ? (
        <RetroGamingPCSpinner label="Loading…" />
      ) : nowPlaying.isError ? (
        <RetroGamingPCAlert message={nowPlaying.error.message} />
      ) : rows.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">{isOwner ? 'Nothing in your Now Playing slots yet.' : 'Not playing anything right now.'}</Text>
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
                    <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
                      {game?.name ?? '…'}
                    </Text>
                    {row.preliminary_score !== null ? <RetroGamingPCRating rating={slotRating(row)} size="compact" suffix="so far" /> : null}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
