import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCButton, RetroGamingPCPanel } from '@/components/ui';
import { useIsGuest } from '@/hooks/useAuth';
import { signOut } from '@/services/auth';

/**
 * Leaves guest mode for the sign-up or sign-in screen. (A guest session is a
 * separate anonymous account; it's cleaned up after 30 days.)
 */
export async function leaveGuestMode(to: '/register' | '/login') {
  await signOut();
  router.replace(to);
}

/** "Create a free account to …" with Create Account / Sign In. */
export function GuestPrompt({ feature, compact = false }: { feature: string; compact?: boolean }) {
  return (
    <View className={compact ? 'gap-2' : 'gap-3'}>
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        You&apos;re browsing as a guest. <Text className="font-bold text-retrogamingpc-text-bright">Create a free account</Text> to{' '}
        {feature}.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <RetroGamingPCButton variant="create" label="Create Account" onPress={() => void leaveGuestMode('/register')} />
        <RetroGamingPCButton variant="navigate" label="Sign In" onPress={() => void leaveGuestMode('/login')} />
      </View>
    </View>
  );
}

/** Renders `children` for members; guests get the prompt (or `fallback`, e.g. null to hide). */
export function MembersOnly({ feature, children, fallback }: { feature: string; children: ReactNode; fallback?: ReactNode }) {
  const isGuest = useIsGuest();
  if (!isGuest) return <>{children}</>;
  return fallback !== undefined ? <>{fallback}</> : <GuestPrompt feature={feature} compact />;
}

/** A whole tab or page that only makes sense with an account. */
export function GuestScreen({ title, feature }: { title: string; feature: string }) {
  return (
    <View className="flex-1 bg-retrogamingpc-dark p-3">
      <View className="w-full self-center md:max-w-[560px]">
        <RetroGamingPCPanel title={title}>
          <GuestPrompt feature={feature} />
        </RetroGamingPCPanel>
      </View>
    </View>
  );
}

/** Slim strip on Home so guests always know how to join. */
export function GuestBanner() {
  const isGuest = useIsGuest();
  if (!isGuest) return null;
  return (
    <View className="retrogamingpc-bevel flex-row flex-wrap items-center justify-between gap-2 bg-retrogamingpc-panel px-3 py-2">
      <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text">
        Browsing as a guest: read anything, but rating, reviews and lists need an account.
      </Text>
      <RetroGamingPCButton variant="create" label="Create Account" onPress={() => void leaveGuestMode('/register')} />
    </View>
  );
}
