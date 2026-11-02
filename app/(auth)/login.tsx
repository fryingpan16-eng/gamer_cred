import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { View } from 'react-native';

import { SteamButton, SteamInput, SteamPanel } from '@/components/ui';
import { steamColors } from '@/constants/theme';

export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steam-dark p-4">
      <SteamPanel title="Sign in to GAMER_CRED" className="w-full max-w-[360px]">
        <View className="gap-2">
          <SteamInput
            label="Email"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            icon={<Feather name="mail" size={12} color={steamColors.textMuted} />}
          />
          <SteamInput
            label="Password"
            secureTextEntry
            autoComplete="current-password"
            icon={<Feather name="lock" size={12} color={steamColors.textMuted} />}
          />
          <View className="flex-row items-center justify-between pt-2">
            <Link href="/register" className="text-steam-sm text-steam-highlight underline">
              Create account
            </Link>
            <SteamButton label="Login" variant="primary" />
          </View>
        </View>
      </SteamPanel>
    </View>
  );
}
