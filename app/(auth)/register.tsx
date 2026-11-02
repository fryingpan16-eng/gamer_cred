import { Feather } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { View } from 'react-native';

import { SteamButton, SteamInput, SteamPanel } from '@/components/ui';
import { steamColors } from '@/constants/theme';

export default function RegisterScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-steam-dark p-4">
      <SteamPanel title="Create a GAMER_CRED account" className="w-full max-w-[360px]">
        <View className="gap-2">
          <SteamInput
            label="Username"
            autoCapitalize="none"
            autoComplete="username"
            hint="3–24 characters: letters, numbers, underscore"
            icon={<Feather name="user" size={12} color={steamColors.textMuted} />}
          />
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
            autoComplete="new-password"
            icon={<Feather name="lock" size={12} color={steamColors.textMuted} />}
          />
          <View className="flex-row items-center justify-between pt-2">
            <Link href="/login" className="text-steam-sm text-steam-highlight underline">
              Have an account?
            </Link>
            <SteamButton label="Register" variant="primary" />
          </View>
        </View>
      </SteamPanel>
    </View>
  );
}
