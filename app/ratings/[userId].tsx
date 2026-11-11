import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { RatingsSpreadsheet } from '@/components/profile/RatingsSpreadsheet';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useGameLookup } from '@/hooks/useGames';
import { useFriendRelation, useProfile } from '@/hooks/useProfile';
import { useRatingsTable } from '@/hooks/useRatings';
import { shownName } from '@/utils/nameRules';
import { isUuid } from '@/utils/ids';
import { toTableRow } from '@/utils/ratingsTable';

/** Profile → Ratings: every game a player has rated, as a sortable / filterable spreadsheet. */
export default function RatingsListScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const userId = isUuid(params.userId) ? params.userId : null;
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const profile = useProfile(userId);
  const table = useRatingsTable(userId);
  const relation = useFriendRelation(userId);
  const isOwner = viewerId !== null && viewerId === userId;
  const canSortFilter = isOwner || relation.data?.state === 'friends';

  // Games the proxy never cached have no metadata in the DB: fetch their names.
  const missing = (table.data ?? []).filter((r) => r.name === null).map((r) => r.game_id);
  const lookup = useGameLookup(missing);
  const rows = useMemo(
    () => (table.data ?? []).map((r) => toTableRow(r, lookup.data?.get(r.game_id)?.name)),
    [table.data, lookup.data],
  );

  const name = isOwner ? 'You' : ((profile.data ? shownName(profile.data.username, profile.data.display_name) : 'This player'));
  const title = isOwner ? 'Your Ratings' : profile.data ? `${shownName(profile.data.username, profile.data.display_name)}'s Ratings` : 'Ratings';

  return (
    <View className="flex-1 bg-retrogamingpc-dark p-3">
      <Stack.Screen options={{ title }} />
      {userId === null ? (
        <RetroGamingPCPanel title="Ratings">
          <RetroGamingPCAlert message="That player doesn’t exist." />
        </RetroGamingPCPanel>
      ) : table.isPending ? (
        <RetroGamingPCSpinner label="Loading ratings…" />
      ) : table.isError ? (
        <RetroGamingPCPanel title="Couldn't load ratings">
          <View className="gap-2">
            <RetroGamingPCAlert message={table.error.message} />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void table.refetch()} />
            </View>
          </View>
        </RetroGamingPCPanel>
      ) : rows.length === 0 ? (
        <RetroGamingPCPanel title={title}>
          <RetroGamingPCAlert tone="info" message={isOwner ? 'You haven’t rated any games yet.' : 'No ratings yet.'} />
        </RetroGamingPCPanel>
      ) : (
        <RatingsSpreadsheet rows={rows} canSortFilter={canSortFilter} ownerName={name} />
      )}
    </View>
  );
}
