import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

type SteamPanelProps = {
  title?: string;
  children?: ReactNode;
  className?: string;
};

/** Beveled 2004-Steam content panel with optional header strip. */
export function SteamPanel({ title, children, className = '' }: SteamPanelProps) {
  return (
    <View className={`steam-bevel bg-steam-card ${className}`}>
      {title ? (
        <View className="steam-panel-header">
          <Text className="steam-heading">{title}</Text>
        </View>
      ) : null}
      <View className="p-3">{children}</View>
    </View>
  );
}
