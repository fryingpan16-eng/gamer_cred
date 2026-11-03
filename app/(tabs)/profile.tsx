import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { FavoritesShowcase } from '@/components/profile/FavoritesShowcase';
import { NowPlayingShowcase } from '@/components/profile/NowPlayingShowcase';
import { PlatformRoster } from '@/components/profile/PlatformRoster';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PublishedReviews } from '@/components/profile/PublishedReviews';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

/**
 * Own profile: the public gamer card (as others see it) plus editing controls.
 * Desktop: showcase column (left) + roster column (right). Settings live on /settings.
 */
export default function ProfileScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const profile = useProfile(userId);

  if (!userId || profile.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-retrogamingpc-dark">
        <RetroGamingPCSpinner label="Loading profile…" />
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <RetroGamingPCPanel title="Profile unavailable">
          <View className="gap-2">
            <RetroGamingPCAlert
              message={
                profile.error?.message ??
                'No profile row exists for this account. Apply migration 000002 (profile provisioning) and sign in again.'
              }
            />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void profile.refetch()} />
            </View>
          </View>
        </RetroGamingPCPanel>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="gap-3 p-3" keyboardShouldPersistTaps="handled">
      <ProfileHeader
        profile={profile.data}
        actions={<RetroGamingPCButton label="⚙ Settings" onPress={() => router.push('/settings')} />}
      />
      <View className="gap-3 md:flex-row md:items-start">
        <View className="gap-3 md:flex-[3]">
          <NowPlayingShowcase userId={userId} isOwner visibility={profile.data.now_playing_visibility} />
          <FavoritesShowcase userId={userId} editable />
          <PublishedReviews userId={userId} isOwner />
        </View>
        <View className="gap-3 md:flex-[2]">
          <PlatformRoster userId={userId} editable />
        </View>
      </View>
    </ScrollView>
  );
}
