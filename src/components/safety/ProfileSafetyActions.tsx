import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCConfirmModal } from '@/components/ui';
import { useShownName } from '@/components/user/UserName';
import { useIsAdmin } from '@/hooks/useLists';
import { useAdminResetDisplayName } from '@/hooks/useNames';
import { useBlockUser } from '@/hooks/useSafety';
import { showToast } from '@/hooks/useToastStore';

import { ReportModal } from './ReportModal';

/** Report / Block on another player's profile; admins can also reset a display name. */
export function ProfileSafetyActions({ userId, username }: { userId: string; username: string }) {
  const block = useBlockUser();
  const isAdmin = useIsAdmin();
  const reset = useAdminResetDisplayName();
  const shown = useShownName(userId, username);
  const name = shown.name;
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <View className="flex-row flex-wrap gap-2">
      <RetroGamingPCButton label="⚑ Report" onPress={() => setReporting(true)} />
      <RetroGamingPCButton variant="danger" label="Block" onPress={() => setConfirmBlock(true)} />
      {isAdmin.data && shown.hasDisplayName ? (
        <RetroGamingPCButton variant="danger" label="Reset Display Name" onPress={() => setConfirmReset(true)} />
      ) : null}
      <ReportModal
        subject={
          reporting
            ? { targetType: 'user', targetId: userId, targetUserId: userId, label: `${name} (@${username})`, ownerName: name }
            : null
        }
        onClose={() => setReporting(false)}
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
      {reset.isError ? <RetroGamingPCAlert message={reset.error.message} /> : null}
    </View>
  );
}
