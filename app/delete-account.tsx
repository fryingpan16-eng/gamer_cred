import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

import { RetroGamingPCPanel } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/constants/legal';

const Para = ({ children }: { children: string }) => <Text className="text-retrogamingpc-sm leading-[19px] text-retrogamingpc-text">{children}</Text>;

/**
 * Public account-deletion page (Google Play requires a web link where users can
 * request deletion without the app). Reachable signed out at /delete-account.
 */
export default function DeleteAccountInfoScreen() {
  return (
    <ScrollView className="flex-1 bg-retrogamingpc-dark" contentContainerClassName="w-full gap-3 self-center p-3 md:max-w-[760px]">
      <Stack.Screen options={{ title: 'Delete your GamerCred account' }} />
      <RetroGamingPCPanel title="Delete your GamerCred account">
        <View className="gap-2">
          <Para>In the app: open Profile → ⚙ Settings → Delete Account, type your username, then tap Delete Forever. Your account is deleted immediately.</Para>
          <Para>{`Can't use the app? Email ${SUPPORT_EMAIL} from the email address on your account with the subject "Delete my account". We'll delete it within 7 days and reply to confirm.`}</Para>
        </View>
      </RetroGamingPCPanel>
      <RetroGamingPCPanel title="What is deleted">
        <View className="gap-2">
          <Para>Everything linked to your account: your sign-in, profile, username and profile picture; your ratings, reviews and drafts; your lists, Now Playing, Top 4 favourites, platforms and PC specs; your friends, friend requests, blocks and terms acceptance.</Para>
          <Para>Reports you sent are kept for moderation without your name attached. Deleted data may remain in encrypted database backups for a limited period until those backups expire; it is not restored to the app.</Para>
        </View>
      </RetroGamingPCPanel>
    </ScrollView>
  );
}
