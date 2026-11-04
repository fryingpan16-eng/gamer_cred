import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { CoverGridScreen } from '@/components/games/CoverGridScreen';
import { RetroGamingPCAlert } from '@/components/ui';
import { useBacklog } from '@/hooks/useBacklog';
import { useProfile, useViewerId } from '@/hooks/useProfile';
import { BACKLOG_MAX } from '@/services/backlog';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A player's whole backlog, newest first (private backlogs: only their owner). */
export default function BacklogScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const validId = typeof userId === 'string' && UUID_PATTERN.test(userId);
  const viewerId = useViewerId();
  const profile = useProfile(validId ? userId : null);
  const isOwner = validId && userId === viewerId;
  const hidden = !isOwner && profile.data?.backlog_visibility === 'private';
  const backlog = useBacklog(validId && !hidden ? userId : null);
  const title = isOwner ? 'Your Backlog' : profile.data ? `${profile.data.username}’s Backlog` : 'Backlog';

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title }} />
      {!validId ? (
        <View className="p-3">
          <RetroGamingPCAlert message="This player doesn't exist." />
        </View>
      ) : hidden ? (
        <View className="p-3">
          <RetroGamingPCAlert tone="info" message="This backlog is private." />
        </View>
      ) : (
        <CoverGridScreen
          gameIds={backlog.data?.gameIds}
          total={backlog.data?.total ?? 0}
          max={BACKLOG_MAX}
          isPending={backlog.isPending || profile.isPending}
          error={backlog.error}
          onRetry={() => void backlog.refetch()}
          emptyText="Nothing in this backlog yet."
          filterLabel="Filter backlog"
        />
      )}
    </View>
  );
}
