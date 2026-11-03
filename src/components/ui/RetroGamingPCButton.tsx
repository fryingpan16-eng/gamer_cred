import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type PressableProps } from 'react-native';


import { ACTION_COLORS, isActionKind, type ActionKind } from '@/constants/actionColors';
import { cn } from '@/utils/cn';
import { TOUCH_SLOP } from '@/utils/platform';
import { useThemeColors } from '@/hooks/useTheme';

/**
 * `default` / `primary` follow the colour theme. The action variants are fixed
 * colours in every theme (src/constants/actionColors.ts):
 *   save (green) · cancel (red) · danger (deep red, ⚠) · create (amber) · navigate (blue)
 */
export type RetroGamingPCButtonVariant = 'default' | 'primary' | ActionKind;

export type RetroGamingPCButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: RetroGamingPCButtonVariant;
  /** Leading icon element. */
  icon?: ReactNode;
  /** Shows a spinner in place of the icon and blocks presses. */
  loading?: boolean;
  className?: string;
};

const THEMED_SURFACE: Record<'default' | 'primary', string> = {
  default: 'bg-retrogamingpc-button',
  primary: 'bg-retrogamingpc-active',
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
  const action = isActionKind(variant) ? ACTION_COLORS[variant] : null;
  // Fixed-colour face + bevel in that hue (inverted while pressed).
  const actionStyle = action
    ? {
        backgroundColor: pressed ? action.pressed : hovered && !disabled ? action.hover : action.fill,
        borderTopColor: pressed ? action.dark : action.light,
        borderLeftColor: pressed ? action.dark : action.light,
        borderBottomColor: pressed ? action.light : action.dark,
        borderRightColor: pressed ? action.light : action.dark,
      }
    : undefined;
  const labelColor = action ? action.label : undefined;
  const leading = loading ? (
    <ActivityIndicator size="small" color={labelColor ?? themeColors.textBright} />
  ) : (
    (icon ?? (variant === 'danger' ? <Text style={{ color: labelColor }} className="text-retrogamingpc-base font-bold">⚠</Text> : null))
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      // The ⚠ glyph on danger buttons is decoration; screen readers hear the label.
      accessibilityLabel={label}
      // 26px tall chrome, ~42px touch area on phones.
      hitSlop={TOUCH_SLOP}
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
      style={actionStyle}
      className={cn(
        'min-h-[26px] items-center justify-center px-3 py-1',
        action
          ? 'border'
          : cn(
              pressed ? 'retrogamingpc-bevel-inset bg-retrogamingpc-dark' : 'retrogamingpc-bevel',
              !pressed && THEMED_SURFACE[variant as 'default' | 'primary'],
              hovered && !pressed && !disabled && 'bg-retrogamingpc-panel',
            ),
        disabled && 'opacity-50',
        className,
      )}
    >
      <View className={cn('flex-row items-center gap-2', pressed && 'translate-x-px translate-y-px')}>
        {leading}
        <Text style={labelColor ? { color: labelColor } : undefined} className={cn('text-retrogamingpc-base font-bold', !action && 'text-retrogamingpc-text-bright')}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
