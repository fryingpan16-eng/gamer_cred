import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type SteamPanelProps = {
  title?: string;
  /** Optional element rendered at the right of the header strip. */
  headerRight?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Beveled 2004-Steam content panel with optional header strip. */
export function SteamPanel({ title, headerRight, children, className }: SteamPanelProps) {
  return (
    <View className={cn('steam-bevel bg-steam-card', className)}>
      {title ? (
        <View className="steam-panel-header flex-row items-center justify-between">
          <Text className="steam-heading" numberOfLines={1}>
            {title}
          </Text>
          {headerRight}
        </View>
      ) : null}
      <View className="p-3">{children}</View>
    </View>
  );
}
