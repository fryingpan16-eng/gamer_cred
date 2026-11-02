import { Link } from 'expo-router';
import { Text, TextInput, View } from 'react-native';

import { SteamButton } from '@/components/SteamButton';
import { SteamPanel } from '@/components/SteamPanel';

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steam-dark p-4">
      <SteamPanel title="Sign in to GAMER_CRED" className="w-full max-w-[360px]">
        <View className="gap-2">
          <Text className="steam-label">Email</Text>
          <TextInput className="steam-input" autoCapitalize="none" keyboardType="email-address" />
          <Text className="steam-label">Password</Text>
          <TextInput className="steam-input" secureTextEntry />
          <View className="flex-row items-center justify-between pt-2">
            <Link href="/register" className="text-steam-highlight text-steam-sm underline">
              Create account
            </Link>
            <SteamButton label="Login" />
          </View>
        </View>
      </SteamPanel>
    </View>
  );
}
