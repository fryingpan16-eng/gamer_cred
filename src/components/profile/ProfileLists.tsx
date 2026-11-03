import { Text } from 'react-native';

import { NewListButton } from '@/components/lists/HomeLists';
import { ListCards } from '@/components/lists/ListCard';
import { RetroGamingPCAlert, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useUserLists } from '@/hooks/useLists';

/** A player's game lists (RLS shows others only their public lists; the owner sees private ones too). */
export function ProfileLists({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const lists = useUserLists(userId);
  return (
    <RetroGamingPCPanel title={`Lists${lists.data ? ` (${lists.data.length})` : ''}`} headerRight={isOwner ? <NewListButton /> : undefined}>
      {lists.isPending ? (
        <RetroGamingPCSpinner label="Loading lists…" />
      ) : lists.isError ? (
        <RetroGamingPCAlert message={lists.error.message} />
      ) : lists.data.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">{isOwner ? 'You haven’t made a list yet.' : 'No public lists yet.'}</Text>
      ) : (
        <ListCards lists={lists.data} showOwner={false} />
      )}
    </RetroGamingPCPanel>
  );
}
