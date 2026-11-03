import { useState, type ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { cn } from '@/utils/cn';

export type RetroGamingPCCardProps = Omit<PressableProps, 'children' | 'style'> & {
  children: ReactNode;
  /** Visually mark as the selected item in a list. */
  selected?: boolean;
  className?: string;
};

/**
 * Raised, tactile container for review cards, game covers, and friend entries.
 * Interactive when `onPress` is given: hover lightens, press sinks the bevel.
 */
export function RetroGamingPCCard({ children, selected = false, className, onPress, ...rest }: RetroGamingPCCardProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  const classes = cn(
    'p-2',
    pressed ? 'retrogamingpc-bevel-inset bg-retrogamingpc-dark' : 'retrogamingpc-bevel',
    !pressed && (selected ? 'bg-retrogamingpc-panel' : hovered ? 'bg-retrogamingpc-panel' : 'bg-retrogamingpc-card'),
    selected && !pressed && 'border-retrogamingpc-highlight',
    className,
  );

  if (!onPress) {
    return <View className={classes}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        rest.onPressOut?.(e);
      }}
      onHoverIn={(e) => {
        setHovered(true);
        rest.onHoverIn?.(e);
      }}
      onHoverOut={(e) => {
        setHovered(false);
        rest.onHoverOut?.(e);
      }}
      className={classes}
    >
      {children}
    </Pressable>
  );
}
