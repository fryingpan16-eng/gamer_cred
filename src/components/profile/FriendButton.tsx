import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { SteamAlert, SteamButton, SteamConfirmModal, SteamSpinner } from '@/components/ui';
import { useFriendRelation, useFriendRequestMutation } from '@/hooks/useProfile';

type FriendButtonProps = { otherId: string; otherName: string };

/**
 * Reactive friend control:
 *   none → "Add Friend" · outgoing → "Request Pending" (cancel) · incoming → Accept / Decline
 *   friends → "Friends ✓" (unfriend). A declined outgoing request still reads
 *   "Request Pending" so declines stay private.
 */
export function FriendButton({ otherId, otherName }: FriendButtonProps) {
  const relation = useFriendRelation(otherId);
  const mutation = useFriendRequestMutation(otherId);
  const [confirm, setConfirm] = useState<'cancel' | 'unfriend' | null>(null);

  if (relation.isPending) return <SteamSpinner />;
  if (relation.isError) return <SteamAlert message={relation.error.message} />;

  const r = relation.data;
  const busy = mutation.isPending;
  let control: ReactNode;

  if (r.state === 'none') {
    control = <SteamButton label="Add Friend" variant="primary" loading={busy} onPress={() => mutation.mutate({ action: 'send' })} />;
  } else if (r.state === 'outgoing' || (r.state === 'declined' && r.direction === 'outgoing')) {
    control = (
      <SteamButton
        label="Request Pending"
        disabled={busy || r.friendshipId === 'pending-optimistic'}
        onPress={() => setConfirm('cancel')}
      />
    );
  } else if (r.state === 'incoming') {
    control = (
      <>
        <SteamButton label="Decline" disabled={busy} onPress={() => mutation.mutate({ action: 'decline', friendshipId: r.friendshipId })} />
        <SteamButton
          label="Accept Request"
          variant="primary"
          loading={busy}
          onPress={() => mutation.mutate({ action: 'accept', friendshipId: r.friendshipId })}
        />
      </>
    );
  } else if (r.state === 'declined') {
    // I declined them earlier; adding them now accepts their original request (unique pair index).
    control = (
      <SteamButton
        label="Add Friend"
        variant="primary"
        loading={busy}
        onPress={() => mutation.mutate({ action: 'accept', friendshipId: r.friendshipId })}
      />
    );
  } else {
    control = <SteamButton label="Friends ✓" disabled={busy} onPress={() => setConfirm('unfriend')} />;
  }

  const friendshipId = r.state === 'none' ? null : r.friendshipId;

  return (
    <View className="items-end gap-1">
      <View className="flex-row gap-2">{control}</View>
      {mutation.isError ? <SteamAlert message={mutation.error.message} /> : null}
      <SteamConfirmModal
        visible={confirm !== null}
        title={confirm === 'cancel' ? 'Cancel friend request' : 'Remove friend'}
        message={
          confirm === 'cancel' ? `Withdraw your friend request to ${otherName}?` : `Remove ${otherName} from your friends?`
        }
        confirmLabel={confirm === 'cancel' ? 'Withdraw' : 'Remove'}
        destructive
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (friendshipId) mutation.mutate({ action: 'remove', friendshipId }, { onSettled: () => setConfirm(null) });
        }}
      />
    </View>
  );
}
