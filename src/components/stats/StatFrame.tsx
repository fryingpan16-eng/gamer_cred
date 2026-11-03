import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCSpinner } from '@/components/ui';

type StatFrameProps = {
  isPending: boolean;
  error: Error | null;
  /** True when the user has nothing logged for this stat yet. */
  isEmpty: boolean;
  onRetry: () => void;
  emptyMessage?: string;
  children: ReactNode;
};

/** Loading → error (with retry) → empty → content, shared by every stat. */
export function StatFrame({ isPending, error, isEmpty, onRetry, emptyMessage = 'Log some games to see this.', children }: StatFrameProps) {
  if (isPending) return <RetroGamingPCSpinner label="Crunching your stats…" className="py-6" />;
  if (error) {
    return (
      <View className="gap-2">
        <RetroGamingPCAlert message={error.message} />
        <View className="flex-row justify-end">
          <RetroGamingPCButton label="Retry" onPress={onRetry} />
        </View>
      </View>
    );
  }
  if (isEmpty) {
    return (
      <View className="retrogamingpc-bevel-inset items-center bg-retrogamingpc-dark px-4 py-8">
        <Text className="text-center text-retrogamingpc-sm text-retrogamingpc-text">{emptyMessage}</Text>
      </View>
    );
  }
  return <>{children}</>;
}
