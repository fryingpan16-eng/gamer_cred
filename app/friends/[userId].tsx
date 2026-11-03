import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCButton,
  RetroGamingPCConfirmModal,
  RetroGamingPCPanel,
  RetroGamingPCSpinner,
} from '@/components/ui';
import { useFriendsList, useFriendsPageAction } from '@/hooks/useFriends';
import { useProfile, useViewerId } from '@/hooks/useProfile';
import type { FriendListEntry } from '@/services/friends';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtSince = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

function openProfile(userId: string, viewerId: string | null) {
  if (userId === viewerId) router.push('/profile');
  else router.push({ pathname: '/user/[id]', params: { id: userId } });
}

/** One player: tap the row to open their profile; owner actions on the right. */
function PersonRow({ entry, viewerId, actions }: { entry: FriendListEntry; viewerId: string | null; actions?: React.ReactNode }) {
  const { person } = entry;
  const subtitle =
    entry.kind === 'friend' ? `Friends since ${fmtSince(entry.since)}` : entry.kind === 'incoming' ? 'Wants to be your friend' : 'Request sent';
  return (
    <View className="retrogamingpc-bevel flex-row flex-wrap items-center gap-2 bg-retrogamingpc-card p-2">
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${person.username}. Open profile`}
        onPress={() => openProfile(person.id, viewerId)}
        className="min-w-[160px] flex-1 flex-row items-center gap-3"
      >
        <Thumbnail uri={person.avatar_url} fallback={person.username} shape="square" accessibilityLabel="" />
        <View className="flex-1 gap-0.5">
          <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
            {person.username}
          </Text>
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{subtitle}</Text>
        </View>
      </Pressable>
      {actions ? <View className="flex-row gap-2">{actions}</View> : null}
    </View>
  );
}

/**
 * A player's friends list (from the friend count on a profile). On your own page it also
 * shows pending requests, with accept / decline / cancel and unfriend.
 */
export default function FriendsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const validId = typeof userId === 'string' && UUID_PATTERN.test(userId);
  const viewerId = useViewerId();
  const isOwner = validId && userId === viewerId;
  const profile = useProfile(validId ? userId : null);
  const list = useFriendsList(validId ? userId : null);
  const action = useFriendsPageAction();
  const [unfriending, setUnfriending] = useState<FriendListEntry | null>(null);

  const title = isOwner ? 'Your Friends' : profile.data ? `${profile.data.username}’s Friends` : 'Friends';
  const busyId = action.isPending ? action.variables.friendshipId : null;

  if (!validId) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Friends' }} />
        <RetroGamingPCAlert message="This player doesn't exist." />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="gap-3 p-3">
      <Stack.Screen options={{ title }} />
      {list.isPending ? (
        <RetroGamingPCSpinner label="Loading friends…" />
      ) : list.isError ? (
        <View className="gap-2">
          <RetroGamingPCAlert message={list.error.message} />
          <View className="flex-row justify-end">
            <RetroGamingPCButton label="Retry" onPress={() => void list.refetch()} />
          </View>
        </View>
      ) : (
        <>
          {isOwner && list.data.incoming.length > 0 ? (
            <RetroGamingPCPanel title={`Friend Requests (${list.data.incoming.length})`}>
              <View className="gap-2">
                {list.data.incoming.map((entry) => (
                  <PersonRow
                    key={entry.friendshipId}
                    entry={entry}
                    viewerId={viewerId}
                    actions={
                      <>
                        <RetroGamingPCButton
                          variant="save"
                          label="Accept"
                          loading={busyId === entry.friendshipId && action.variables?.action === 'accept'}
                          disabled={busyId === entry.friendshipId}
                          onPress={() => action.mutate({ action: 'accept', friendshipId: entry.friendshipId })}
                        />
                        <RetroGamingPCButton
                          variant="cancel"
                          label="Decline"
                          disabled={busyId === entry.friendshipId}
                          onPress={() => action.mutate({ action: 'decline', friendshipId: entry.friendshipId })}
                        />
                      </>
                    }
                  />
                ))}
              </View>
            </RetroGamingPCPanel>
          ) : null}

          <RetroGamingPCPanel title={`Friends (${list.data.friends.length})`}>
            {list.data.friends.length === 0 ? (
              <View className="gap-2">
                <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
                  {isOwner ? 'No friends yet.' : 'No friends to show yet.'}
                </Text>
                {isOwner ? (
                  <View className="flex-row">
                    <RetroGamingPCButton variant="navigate" label="Find players" onPress={() => router.push({ pathname: '/search', params: { tab: 'users' } })} />
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="gap-2">
                {list.data.friends.map((entry) => (
                  <PersonRow
                    key={entry.friendshipId}
                    entry={entry}
                    viewerId={viewerId}
                    actions={
                      isOwner ? (
                        <RetroGamingPCButton
                          variant="danger"
                          label="Unfriend"
                          disabled={busyId === entry.friendshipId}
                          onPress={() => setUnfriending(entry)}
                        />
                      ) : undefined
                    }
                  />
                ))}
              </View>
            )}
          </RetroGamingPCPanel>

          {isOwner && list.data.outgoing.length > 0 ? (
            <RetroGamingPCPanel title={`Sent Requests (${list.data.outgoing.length})`}>
              <View className="gap-2">
                {list.data.outgoing.map((entry) => (
                  <PersonRow
                    key={entry.friendshipId}
                    entry={entry}
                    viewerId={viewerId}
                    actions={
                      <RetroGamingPCButton
                        variant="cancel"
                        label="Cancel"
                        loading={busyId === entry.friendshipId}
                        onPress={() => action.mutate({ action: 'remove', friendshipId: entry.friendshipId })}
                      />
                    }
                  />
                ))}
              </View>
            </RetroGamingPCPanel>
          ) : null}
        </>
      )}

      <RetroGamingPCConfirmModal
        visible={unfriending !== null}
        title="Unfriend?"
        message={unfriending ? `Remove ${unfriending.person.username} from your friends? You can send a new request later.` : ''}
        confirmLabel="Unfriend"
        destructive
        busy={action.isPending}
        onCancel={() => setUnfriending(null)}
        onConfirm={() => {
          if (!unfriending) return;
          action.mutate({ action: 'remove', friendshipId: unfriending.friendshipId }, { onSettled: () => setUnfriending(null) });
        }}
      />
    </ScrollView>
  );
}
