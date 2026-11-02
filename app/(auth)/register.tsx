import { Link } from 'expo-router';
import { Text, TextInput, View } from 'react-native';

import { SteamButton } from '@/components/SteamButton';
import { SteamPanel } from '@/components/SteamPanel';

export default function RegisterScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steam-dark p-4">
      <SteamPanel title="Create a GAMER_CRED account" className="w-full max-w-[360px]">
        <View className="gap-2">
          <Text className="steam-label">Username</Text>
          <TextInput className="steam-input" autoCapitalize="none" />
          <Text className="steam-label">Email</Text>
          <TextInput className="steam-input" autoCapitalize="none" keyboardType="email-address" />
          <Text className="steam-label">Password</Text>
          <TextInput className="steam-input" secureTextEntry />
          <View className="flex-row items-center justify-between pt-2">
            <Link href="/login" className="text-steam-highlight text-steam-sm underline">
              Have an account?
            </Link>
            <SteamButton label="Register" />
          </View>
        </View>
      </SteamPanel>
    </View>
  );
}
