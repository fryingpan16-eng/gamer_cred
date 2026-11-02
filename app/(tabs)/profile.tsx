import { ScrollView, View } from 'react-native';

import { AccountSettings } from '@/components/profile/AccountSettings';
import { FavoritesShowcase } from '@/components/profile/FavoritesShowcase';
import { NowPlayingShowcase } from '@/components/profile/NowPlayingShowcase';
import { PlatformRoster } from '@/components/profile/PlatformRoster';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { PublishedReviews } from '@/components/profile/PublishedReviews';
import { SteamAlert, SteamButton, SteamPanel, SteamSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';

/**
 * Own profile: the public gamer card (as others see it) plus editing controls.
 * Desktop: showcase column (left) + roster/account column (right).
 */
export default function ProfileScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const profile = useProfile(userId);

  if (!userId || profile.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-steam-dark">
        <SteamSpinner label="Loading profile…" />
      </View>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <View className="flex-1 bg-steam-dark p-3">
        <SteamPanel title="Profile unavailable">
          <View className="gap-2">
            <SteamAlert
              message={
                profile.error?.message ??
                'No profile row exists for this account. Apply migration 000002 (profile provisioning) and sign in again.'
              }
            />
            <View className="flex-row justify-end">
              <SteamButton label="Retry" onPress={() => void profile.refetch()} />
            </View>
          </View>
        </SteamPanel>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-steam-dark" contentContainerClassName="gap-3 p-3" keyboardShouldPersistTaps="handled">
      <ProfileHeader profile={profile.data} />
      <View className="gap-3 md:flex-row md:items-start">
        <View className="gap-3 md:flex-[3]">
          <NowPlayingShowcase userId={userId} isOwner />
          <FavoritesShowcase userId={userId} editable />
          <PublishedReviews userId={userId} isOwner />
        </View>
        <View className="gap-3 md:flex-[2]">
          <PlatformRoster userId={userId} editable />
          <AccountSettings profile={profile.data} />
        </View>
      </View>
    </ScrollView>
  );
}
