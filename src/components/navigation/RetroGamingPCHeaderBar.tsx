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

function BackButton({ onPress, large }: { onPress: () => void; large: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      // Phones: ≥ 44px tall with extra slop, so it's an easy thumb target.
      hitSlop={large ? { top: 6, bottom: 6, left: 8, right: 8 } : 6}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cn(
        'items-center justify-center',
        large ? 'min-h-[42px] min-w-[84px] px-3' : 'px-2 py-0.5',
        pressed ? 'retrogamingpc-bevel-inset bg-retrogamingpc-dark' : 'retrogamingpc-bevel bg-retrogamingpc-button',
      )}
    >
      <Text className={cn('font-bold text-retrogamingpc-text-bright', large ? 'text-retrogamingpc-lg' : 'text-retrogamingpc-sm')}>◀ Back</Text>
    </Pressable>
  );
}

/**
 * Retro window-section header showing the current screen title.
 * Fixed height per breakpoint so screens never shift when the title changes:
 * taller on phones (thumb-sized back button), compact on desktop, where the
 * title is prefixed with a breadcrumb.
 */
export function RetroGamingPCHeaderBar({ title, onBack, right }: RetroGamingPCHeaderBarProps) {
  const isDesktop = useIsDesktop();
  return (
    <View
      style={{ height: isDesktop ? retroGamingPCLayout.headerHeight : retroGamingPCLayout.headerHeightMobile }}
      className="flex-row items-center gap-2 border-b border-b-retrogamingpc-bevel-dark bg-retrogamingpc-panel px-2"
    >
      {onBack ? <BackButton onPress={onBack} large={!isDesktop} /> : null}
      <Text
        role="heading"
        className={cn('flex-1 font-bold text-retrogamingpc-text-bright', isDesktop ? 'text-retrogamingpc-lg' : 'text-retrogamingpc-xl')}
        numberOfLines={1}
      >
        {isDesktop ? <Text className="text-retrogamingpc-sm font-normal text-retrogamingpc-text-muted">GAMER_CRED › </Text> : null}
        {title}
      </Text>
      {right}
    </View>
  );
}
