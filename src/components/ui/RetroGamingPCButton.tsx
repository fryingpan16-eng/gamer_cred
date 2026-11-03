import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';


import { cn } from '@/utils/cn';
import { useThemeColors } from '@/hooks/useTheme';

export type RetroGamingPCButtonVariant = 'default' | 'primary' | 'danger';

export type RetroGamingPCButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: RetroGamingPCButtonVariant;
  /** Leading icon element. */
  icon?: ReactNode;
  /** Shows a spinner in place of the icon and blocks presses. */
  loading?: boolean;
  className?: string;
};

const SURFACE: Record<RetroGamingPCButtonVariant, string> = {
  default: 'bg-retrogamingpc-button',
  primary: 'bg-retrogamingpc-active',
  danger: 'bg-retrogamingpc-button',
};

/**
 * Raised bevel button. While pressed the bevel inverts (sunken). Border widths
 * never change between states, only colors, so pressing never shifts layout.
 */
export function RetroGamingPCButton({
  label,
  variant = 'default',
  icon,
  loading = false,
  disabled: disabledProp,
  className,
  ...rest
}: RetroGamingPCButtonProps) {
  const themeColors = useThemeColors();
  const disabled = !!disabledProp || loading;
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
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
        'min-h-[26px] items-center justify-center px-3 py-1',
        pressed ? 'retrogamingpc-bevel-inset bg-retrogamingpc-dark' : 'retrogamingpc-bevel',
        !pressed && SURFACE[variant],
        hovered && !pressed && !disabled && 'bg-retrogamingpc-panel',
        disabled && 'opacity-50',
        className,
      )}
    >
      <View className={cn('flex-row items-center gap-2', pressed && 'translate-x-px translate-y-px')}>
        {loading ? <ActivityIndicator size="small" color={themeColors.textBright} /> : icon}
        <Text
          className={cn(
            'text-retrogamingpc-base font-bold',
            variant === 'danger' ? 'text-retrogamingpc-error' : 'text-retrogamingpc-text-bright',
          )}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
