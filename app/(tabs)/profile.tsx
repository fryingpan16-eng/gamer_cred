import { Text, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { SteamAlert, SteamBadge, SteamButton, SteamCard, SteamPanel, SteamSpinner } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthAction } from '@/hooks/useAuthAction';
import { signOut } from '@/services/auth';

const SECTIONS = [
  { title: 'Now Playing', description: 'Public view of your 4 active Now Playing slots.' },
  { title: 'Top 4 Favorites', description: 'Your all-time favorite games showcase.' },
] as const;

export default function ProfileScreen() {
  const { user, profile, profileStatus } = useAuth();
  const logout = useAuthAction(signOut);

  return (
    <ScreenPlaceholder subtitle="Your public gamer card" sections={SECTIONS}>
      <SteamPanel
        title="Account"
        headerRight={
          <SteamButton
            label="Sign out"
            loading={logout.pending}
            onPress={() => void logout.run()}
          />
        }
      >
        <View className="gap-1">
          {profileStatus === 'loading' ? (
            <SteamSpinner label="Loading profile…" />
          ) : (
            <Text className="text-steam-lg font-bold text-steam-text-bright">
              {profile?.username ?? 'Profile not provisioned'}
            </Text>
          )}
          <Text className="text-steam-sm text-steam-text-muted">{user?.email}</Text>
          {logout.error ? <SteamAlert message={logout.error} className="mt-2" /> : null}
        </View>
      </SteamPanel>

      <SteamPanel title="Hardware & Platforms">
        <View className="flex-row flex-wrap gap-2">
          <SteamCard className="min-w-[140px] gap-1">
            <Text className="text-steam-base font-bold text-steam-text-bright">PC</Text>
            <SteamBadge label="Main Platform" variant="main" />
            <Text className="text-steam-xs text-steam-text-muted">Specs: not set</Text>
          </SteamCard>
          <SteamCard className="min-w-[140px] items-center justify-center">
            <Text className="text-steam-sm text-steam-text-muted">+ Add platform</Text>
          </SteamCard>
        </View>
      </SteamPanel>
    </ScreenPlaceholder>
  );
}
