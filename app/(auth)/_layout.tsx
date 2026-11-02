import { Stack } from 'expo-router';

import { steamStackHeader } from '@/components/navigation/steamStackHeader';
import { steamColors } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        header: steamStackHeader,
        headerTransparent: false,
        contentStyle: { backgroundColor: steamColors.dark },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In' }} />
      <Stack.Screen name="register" options={{ title: 'Create Account' }} />
    </Stack>
  );
}
