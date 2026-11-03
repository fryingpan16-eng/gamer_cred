import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCCard } from '@/components/ui';
import type { UserSearchResult } from '@/services/users';

import { Thumbnail } from './Thumbnail';

type UserResultCardProps = {
  user: UserSearchResult;
  /** True while a friend action for this user is in flight. */
  pending: boolean;
  onSendRequest: (userId: string) => void;
  onRespond: (friendshipId: string, accept: boolean) => void;
};

export function UserResultCard({ user, pending, onSendRequest, onRespond }: UserResultCardProps) {
  const { relation } = user;

  return (
    <RetroGamingPCCard className="flex-row items-center gap-3">
      <Thumbnail uri={user.avatar_url} fallback={user.username} shape="square" accessibilityLabel={`${user.username} avatar`} />
      <View className="flex-1 gap-1">
        <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
          {user.username}
        </Text>
        {relation.state === 'friends' ? <RetroGamingPCBadge label="Friends" variant="main" /> : null}
        {relation.state === 'outgoing' || (relation.state === 'declined' && relation.direction === 'outgoing') ? (
          // A declined outgoing request is shown as still pending: declines stay private.
          <RetroGamingPCBadge label="Request Sent" variant="draft" />
        ) : null}
        {relation.state === 'incoming' ? <RetroGamingPCBadge label="Wants to be friends" variant="nowPlaying" /> : null}
        <View className="flex-row flex-wrap justify-end gap-2 pt-1">
          <RetroGamingPCButton variant="navigate"
            label="View Profile"
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: user.id } })}
          />
          {relation.state === 'none' ? (
            <RetroGamingPCButton variant="create"
              label="Send Friend Request"
              loading={pending}
              onPress={() => onSendRequest(user.id)}
            />
          ) : null}
          {relation.state === 'declined' && relation.direction === 'incoming' ? (
            // I declined them earlier: re-adding accepts their original request (unique pair index).
            <RetroGamingPCButton variant="create"
              label="Add Friend"
              loading={pending}
              onPress={() => onRespond(relation.friendshipId, true)}
            />
          ) : null}
          {relation.state === 'incoming' ? (
            <>
              <RetroGamingPCButton variant="cancel" label="Decline" disabled={pending} onPress={() => onRespond(relation.friendshipId, false)} />
              <RetroGamingPCButton variant="save"
                label="Accept"
                loading={pending}
                onPress={() => onRespond(relation.friendshipId, true)}
              />
            </>
          ) : null}
        </View>
      </View>
    </RetroGamingPCCard>
  );
}
