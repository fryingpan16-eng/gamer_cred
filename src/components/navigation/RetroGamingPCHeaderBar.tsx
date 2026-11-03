import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { retroGamingPCLayout } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/utils/cn';

export type RetroGamingPCHeaderBarProps = {
  title: string;
  /** Renders a beveled "◀ Back" button when provided. */
  onBack?: () => void;
  right?: ReactNode;
};

function BackButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={6}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cn('px-2 py-0.5', pressed ? 'retrogamingpc-bevel-inset bg-retrogamingpc-dark' : 'retrogamingpc-bevel bg-retrogamingpc-button')}
    >
      <Text className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright">◀ Back</Text>
    </Pressable>
  );
}

/**
 * Retro window-section header showing the current screen title.
 * Fixed height on every platform so screens never shift when the title changes.
 * On desktop the title is prefixed with a breadcrumb.
 */
export function RetroGamingPCHeaderBar({ title, onBack, right }: RetroGamingPCHeaderBarProps) {
  const isDesktop = useIsDesktop();
  return (
    <View
      style={{ height: retroGamingPCLayout.headerHeight }}
      className="flex-row items-center gap-2 border-b border-b-retrogamingpc-bevel-dark bg-retrogamingpc-panel px-2"
    >
      {onBack ? <BackButton onPress={onBack} /> : null}
      <Text role="heading" className="flex-1 text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
        {isDesktop ? <Text className="text-retrogamingpc-sm font-normal text-retrogamingpc-text-muted">GAMER_CRED › </Text> : null}
        {title}
      </Text>
      {right}
    </View>
  );
}
