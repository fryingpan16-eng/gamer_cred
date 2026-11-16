import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCConfirmModal } from '@/components/ui';
import { useShownName } from '@/components/user/UserName';
import { useCanDemoteAdmin, useDemoteAdmin } from '@/hooks/useAdminSecurity';
import { useIsAdmin } from '@/hooks/useLists';
import { useAdminResetDisplayName } from '@/hooks/useNames';
import { useBlockUser } from '@/hooks/useSafety';
import { showToast } from '@/hooks/useToastStore';

import { MoreMenu, type MoreMenuAction } from './MoreMenu';

/** ⋯ on another player's profile: Report, Block, (admins) Reset Display Name and (the owner, on an admin) Remove Admin Role. */
export function ProfileSafetyActions({ userId, username }: { userId: string; username: string }) {
  const block = useBlockUser();
  const isAdmin = useIsAdmin();
  const reset = useAdminResetDisplayName();
  const canDemote = useCanDemoteAdmin(userId, isAdmin.data === true);
  const demote = useDemoteAdmin();
  const shown = useShownName(userId, username);
  const name = shown.name;
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDemote, setConfirmDemote] = useState(false);
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <MoreMenu
        label={name}
        report={{ targetType: 'user', targetId: userId, targetUserId: userId, label: `${name} (@${username})`, ownerName: name }}
        actions={[
          { label: `Block ${name}`, variant: 'danger', onPress: () => setConfirmBlock(true) },
          ...(isAdmin.data && shown.hasDisplayName
            ? [{ label: 'Reset Display Name', variant: 'danger', onPress: () => setConfirmReset(true) } satisfies MoreMenuAction]
            : []),
          ...(canDemote.data
            ? [{ label: 'Remove Admin Role', variant: 'danger', onPress: () => setConfirmDemote(true) } satisfies MoreMenuAction]
            : []),
        ]}
      />
      <RetroGamingPCConfirmModal
        visible={confirmBlock}
        title={`Block ${name}?`}
        message={`You’ll stop being friends, neither of you can send friend requests, and you won’t see each other’s profile, reviews, ratings, lists or activity. ${name} isn’t told. You can unblock in Settings.`}
        confirmLabel="Block"
        destructive
        busy={block.isPending}
        onCancel={() => setConfirmBlock(false)}
        onConfirm={() => block.mutate({ userId, block: true }, { onSettled: () => setConfirmBlock(false) })}
      />
      <RetroGamingPCConfirmModal
        visible={confirmReset}
        title="Reset display name?"
        message={`“${name}” is removed and @${username} shows instead. They can pick a new display name straight away. This is recorded in Moderation → Activity.`}
        confirmLabel="Reset Display Name"
        destructive
        busy={reset.isPending}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() =>
          reset.mutate(userId, {
            onSuccess: () => showToast(`Display name reset. @${username} shows now.`, 'success'),
            onSettled: () => setConfirmReset(false),
          })
        }
      />
      <RetroGamingPCConfirmModal
        visible={confirmDemote}
        title="Remove admin role?"
        message={`${name} (@${username}) loses every admin tool straight away. Their account, reviews and lists stay. Making them an admin again takes the SQL Editor and a new authenticator approval. This is recorded in Moderation → Activity.`}
        confirmLabel="Remove Admin Role"
        destructive
        busy={demote.isPending}
        onCancel={() => setConfirmDemote(false)}
        onConfirm={() =>
          demote.mutate(userId, {
            onSuccess: () => showToast(`${name} is no longer an admin.`, 'success'),
            onSettled: () => setConfirmDemote(false),
          })
        }
      />
      {reset.isError ? <RetroGamingPCAlert message={reset.error.message} /> : null}
      {demote.isError ? <RetroGamingPCAlert message={demote.error.message} /> : null}
    </View>
  );
}
