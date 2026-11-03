import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCButton, RetroGamingPCConfirmModal } from '@/components/ui';
import { useBlockUser } from '@/hooks/useSafety';

import { ReportModal } from './ReportModal';

/** Report / Block on another player's profile. */
export function ProfileSafetyActions({ userId, username }: { userId: string; username: string }) {
  const block = useBlockUser();
  const [reporting, setReporting] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  return (
    <View className="flex-row flex-wrap gap-2">
      <RetroGamingPCButton label="⚑ Report" onPress={() => setReporting(true)} />
      <RetroGamingPCButton variant="danger" label="Block" onPress={() => setConfirmBlock(true)} />
      <ReportModal
        subject={reporting ? { targetType: 'user', targetId: userId, targetUserId: userId, label: username, ownerName: username } : null}
        onClose={() => setReporting(false)}
      />
      <RetroGamingPCConfirmModal
        visible={confirmBlock}
        title={`Block ${username}?`}
        message={`You’ll stop being friends, neither of you can send friend requests, and you won’t see each other’s profile, reviews, ratings, lists or activity. ${username} isn’t told. You can unblock in Settings.`}
        confirmLabel="Block"
        destructive
        busy={block.isPending}
        onCancel={() => setConfirmBlock(false)}
        onConfirm={() => block.mutate({ userId, block: true }, { onSettled: () => setConfirmBlock(false) })}
      />
    </View>
  );
}
