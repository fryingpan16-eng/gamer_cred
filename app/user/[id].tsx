import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { FavoritesShowcase } from '@/components/profile/FavoritesShowcase';
import { FriendButton } from '@/components/profile/FriendButton';
import { NowPlayingShowcase } from '@/components/profile/NowPlayingShowcase';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileRatings } from '@/components/profile/ProfileRatings';
import { PublishedReviews } from '@/components/profile/PublishedReviews';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public, read-only profile of another player, with a reactive friend button. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const validId = typeof id === 'string' && UUID_PATTERN.test(id);
  const profile = useProfile(validId ? id : null);

  // Your own public page is the Profile tab.
  if (validId && id === viewerId) return <Redirect href="/profile" />;

  if (validId && profile.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-retrogamingpc-dark">
        <Stack.Screen options={{ title: 'Player Profile' }} />
        <RetroGamingPCSpinner label="Loading player…" />
      </View>
    );
  }

  if (!validId || profile.isError || !profile.data) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Player not found' }} />
        <RetroGamingPCPanel title="Player not found">
          <View className="gap-2">
            <RetroGamingPCAlert message={profile.error?.message ?? 'This player does not exist or has deleted their account.'} />
            {profile.isError ? (
              <View className="flex-row justify-end">
                <RetroGamingPCButton label="Retry" onPress={() => void profile.refetch()} />
              </View>
            ) : null}
          </View>
        </RetroGamingPCPanel>
      </View>
    );
  }

  const player = profile.data;

  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="gap-3 p-3">
      <Stack.Screen options={{ title: player.username }} />
      <ProfileHeader profile={player} actions={<FriendButton otherId={player.id} otherName={player.username} />} />
      <View className="gap-3 md:flex-row md:items-start">
        <View className="gap-3 md:flex-[3]">
          <NowPlayingShowcase userId={player.id} isOwner={false} visibility={player.now_playing_visibility} />
          <FavoritesShowcase userId={player.id} editable={false} />
        </View>
        <View className="gap-3 md:flex-[2]">
          <ProfileRatings userId={player.id} isOwner={false} />
          <PublishedReviews userId={player.id} isOwner={false} />
        </View>
      </View>
    </ScrollView>
  );
}
