import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { CoverShowcase } from '@/components/games/CoverShowcase';
import { RetroGamingPCButton } from '@/components/ui';
import { useBacklog } from '@/hooks/useBacklog';
import type { Profile } from '@/types/database.types';

import { BacklogAddButton } from './BacklogAddButton';

/** Backlog on a profile. Hidden from others when the player made it private. */
export function BacklogShowcase({ profile, isOwner }: { profile: Profile; isOwner: boolean }) {
  const isPrivate = profile.backlog_visibility === 'private';
  const backlog = useBacklog(isOwner || !isPrivate ? profile.id : null);
  if (!isOwner && isPrivate) return null;
  const total = backlog.data?.total ?? 0;
  return (
    <CoverShowcase
      title={`Backlog${backlog.data ? ` (${total})` : ''}${isOwner && isPrivate ? ' · 🔒 only you' : ''}`}
      gameIds={backlog.data?.gameIds}
      isPending={backlog.isPending}
      error={backlog.error}
      headerRight={
        <View className="flex-row gap-2">
          {isOwner ? <BacklogAddButton /> : null}
          {total > 0 ? (
            <RetroGamingPCButton
              variant="navigate"
              label="View all"
              onPress={() => router.push({ pathname: '/backlog/[userId]', params: { userId: profile.id } })}
            />
          ) : null}
        </View>
      }
      empty={
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          {isOwner ? 'Nothing in your backlog yet. Tap + Add, or use + Backlog on any game page.' : 'Nothing in their backlog yet.'}
        </Text>
      }
    />
  );
}
