import { Text, View } from 'react-native';

import { UserName } from '@/components/user/UserName';
import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCSpinner } from '@/components/ui';
import { useBlockedUsers, useBlockUser } from '@/hooks/useSafety';

/** Players you blocked, with Unblock. */
export function BlockedUsersSetting() {
  const blocked = useBlockedUsers();
  const unblock = useBlockUser();
  if (blocked.isPending) return <RetroGamingPCSpinner label="Loading blocked players…" />;
  if (blocked.isError) return <RetroGamingPCAlert message={blocked.error.message} />;
  if (blocked.data.length === 0) {
    return <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">You haven’t blocked anyone. Block a player from their profile.</Text>;
  }
  return (
    <View className="gap-2">
      {blocked.data.map((b) => (
        <View key={b.userId} className="flex-row items-center gap-2">
          <Thumbnail uri={b.avatarUrl} fallback={b.username} shape="square" accessibilityLabel="" />
          <UserName userId={b.userId} username={b.username} className="flex-1 text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1} />
          <RetroGamingPCButton
            label="Unblock"
            loading={unblock.isPending && unblock.variables?.userId === b.userId}
            onPress={() => unblock.mutate({ userId: b.userId, block: false })}
          />
        </View>
      ))}
    </View>
  );
}
