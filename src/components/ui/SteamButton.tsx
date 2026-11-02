import { useState } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

import { cn } from '@/utils/cn';

export type SteamButtonVariant = 'default' | 'primary' | 'danger';

export type SteamButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: SteamButtonVariant;
  className?: string;
};

const SURFACE: Record<SteamButtonVariant, string> = {
  default: 'bg-steam-button',
  primary: 'bg-steam-active',
  danger: 'bg-steam-button',
};

/**
 * Raised bevel button. While pressed the bevel inverts (sunken). Border widths
 * never change between states, only colors, so pressing never shifts layout.
 */
export function SteamButton({ label, variant = 'default', disabled, className, ...rest }: SteamButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
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
      className={cn(
        'min-h-[24px] items-center justify-center px-3 py-1',
        pressed ? 'steam-bevel-inset bg-steam-dark' : 'steam-bevel',
        !pressed && SURFACE[variant],
        hovered && !pressed && !disabled && 'bg-steam-panel',
        disabled && 'opacity-50',
        className,
      )}
    >
      <Text
        className={cn(
          'text-steam-base font-bold',
          variant === 'danger' ? 'text-steam-error' : 'text-steam-text-bright',
          pressed && 'translate-x-px translate-y-px',
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
