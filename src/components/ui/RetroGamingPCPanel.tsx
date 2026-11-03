import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type RetroGamingPCPanelProps = {
  title?: string;
  /** Optional element rendered at the right of the header strip. */
  headerRight?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Beveled RetroGamingPC content panel with optional header strip. */
export function RetroGamingPCPanel({ title, headerRight, children, className }: RetroGamingPCPanelProps) {
  return (
    <View className={cn('retrogamingpc-bevel bg-retrogamingpc-card', className)}>
      {title ? (
        <View className="retrogamingpc-panel-header flex-row items-center justify-between">
          <Text className="retrogamingpc-heading" numberOfLines={1}>
            {title}
          </Text>
          {headerRight}
        </View>
      ) : null}
      <View className="p-3">{children}</View>
    </View>
  );
}
