import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { AccountSettings } from '@/components/settings/AccountSettings';
import { AdminSecuritySetting } from '@/components/settings/AdminSecuritySetting';
import { AvatarSetting } from '@/components/settings/AvatarSetting';
import { BlockedUsersSetting } from '@/components/settings/BlockedUsersSetting';
import { DeleteAccountSetting } from '@/components/settings/DeleteAccountSetting';
import { HelpSafetySetting } from '@/components/settings/HelpSafetySetting';
import { PlatformSettings } from '@/components/settings/PlatformSettings';
import { PrivacySetting } from '@/components/settings/PrivacySetting';
import { RatingScaleSetting } from '@/components/settings/RatingScaleSetting';
import { ThemeSetting } from '@/components/settings/ThemeSetting';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCPanel, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { GuestScreen } from '@/components/auth/MembersOnly';

/** Settings (opened from the Profile tab): profile picture, appearance, hardware & platforms, ratings, privacy, account. */
export default function SettingsScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const isGuest = useAuthStore((s) => s.isGuest);
  const profile = useProfile(isGuest ? null : userId);
  if (isGuest) return <GuestScreen title="Settings" feature="set up your profile, platforms and rating style" />;

  return (
    <ScrollView
      automaticallyAdjustKeyboardInsets
      className="flex-1 bg-retrogamingpc-dark"
      contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[720px]"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        Changes save automatically, except your display name, which has its own Save button.
      </Text>

      <RetroGamingPCPanel title="Profile Picture">
        <AvatarSetting />
      </RetroGamingPCPanel>

      <RetroGamingPCPanel title="Appearance">
        <ThemeSetting />
      </RetroGamingPCPanel>

      <RetroGamingPCPanel title="Hardware & Platforms">
        <PlatformSettings />
      </RetroGamingPCPanel>

      <RetroGamingPCPanel title="Ratings">
        <RatingScaleSetting />
      </RetroGamingPCPanel>

      <RetroGamingPCPanel title="Privacy">
        <PrivacySetting />
      </RetroGamingPCPanel>

      <RetroGamingPCPanel title="Blocked Players">
        <BlockedUsersSetting />
      </RetroGamingPCPanel>

      <AdminSecuritySetting />

      <RetroGamingPCPanel title="Help & Safety">
        <HelpSafetySetting />
      </RetroGamingPCPanel>

      {profile.data ? (
        <AccountSettings profile={profile.data} />
      ) : profile.isError ? (
        <RetroGamingPCPanel title="Account">
          <View className="gap-2">
            <RetroGamingPCAlert message={profile.error.message} />
            <View className="flex-row justify-end">
              <RetroGamingPCButton label="Retry" onPress={() => void profile.refetch()} />
            </View>
          </View>
        </RetroGamingPCPanel>
      ) : (
        <RetroGamingPCSpinner label="Loading account…" />
      )}

      {profile.data ? (
        <RetroGamingPCPanel title="Delete Account">
          <DeleteAccountSetting username={profile.data.username} />
        </RetroGamingPCPanel>
      ) : null}
    </ScrollView>
  );
}
