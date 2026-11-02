import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { steamLayout } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/utils/cn';

export type SteamHeaderBarProps = {
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
      className={cn('px-2 py-0.5', pressed ? 'steam-bevel-inset bg-steam-dark' : 'steam-bevel bg-steam-button')}
    >
      <Text className="text-steam-sm font-bold text-steam-text-bright">◀ Back</Text>
    </Pressable>
  );
}

/**
 * Retro window-section header showing the current screen title.
 * Fixed height on every platform so screens never shift when the title changes.
 * On desktop the title is prefixed with a breadcrumb.
 */
export function SteamHeaderBar({ title, onBack, right }: SteamHeaderBarProps) {
  const isDesktop = useIsDesktop();
  return (
    <View
      style={{ height: steamLayout.headerHeight }}
      className="flex-row items-center gap-2 border-b border-b-steam-bevel-dark bg-steam-panel px-2"
    >
      {onBack ? <BackButton onPress={onBack} /> : null}
      <Text role="heading" className="flex-1 text-steam-lg font-bold text-steam-text-bright" numberOfLines={1}>
        {isDesktop ? <Text className="text-steam-sm font-normal text-steam-text-muted">GAMER_CRED › </Text> : null}
        {title}
      </Text>
      {right}
    </View>
  );
}
