import { Stack } from 'expo-router';

import { retroGamingPCStackHeader } from '@/components/navigation/retroGamingPCStackHeader';
import { useThemeColors } from '@/hooks/useTheme';

export default function AuthLayout() {
  const themeColors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        header: retroGamingPCStackHeader,
        headerTransparent: false,
        contentStyle: { backgroundColor: themeColors.dark },
      }}
    >
      <Stack.Screen name="login" options={{ title: 'Sign In' }} />
      <Stack.Screen name="register" options={{ title: 'Create Account' }} />
    </Stack>
  );
}
