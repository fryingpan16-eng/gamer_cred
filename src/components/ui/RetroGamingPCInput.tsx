import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/utils/cn';
import { useThemeColors } from '@/hooks/useTheme';

export type RetroGamingPCInputProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label?: string;
  /** Validation message (e.g. from a Zod issue). Presence switches the field to error state. */
  error?: string;
  /** Muted helper text shown when there is no error. */
  hint?: string;
  /** Leading icon slot, e.g. <Feather name="search" />. */
  icon?: ReactNode;
  /** Trailing slot, e.g. a clear button or inline spinner. */
  trailing?: ReactNode;
  className?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/**
 * Sunken (inset-bevel) text field.
 * States: idle → inset bevel; focused → highlight frame; error → error frame + message.
 * The 1px border width is identical in every state so focus never shifts layout.
 */
export function RetroGamingPCInput({
  label,
  error,
  hint,
  icon,
  trailing,
  className,
  editable = true,
  ref,
  ...rest
}: RetroGamingPCInputProps) {
  const themeColors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View className={cn('gap-1', className)}>
      {label ? (
        <Text className={cn('retrogamingpc-label', hasError && 'text-retrogamingpc-error')} nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'min-h-[26px] flex-row gap-2 border bg-retrogamingpc-dark px-2',
          rest.multiline ? 'items-start py-1' : 'items-center',
          hasError
            ? 'border-retrogamingpc-error'
            : focused
              ? 'border-retrogamingpc-highlight'
              : 'border-t-retrogamingpc-bevel-dark border-l-retrogamingpc-bevel-dark border-b-retrogamingpc-bevel-light border-r-retrogamingpc-bevel-light',
          !editable && 'opacity-60',
        )}
      >
        {icon ? <View className="opacity-80">{icon}</View> : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={themeColors.textMuted}
          selectionColor={themeColors.highlight}
          aria-invalid={hasError}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          textAlignVertical={rest.multiline ? 'top' : 'center'}
          className={cn(
            'flex-1 py-1 text-retrogamingpc-base text-retrogamingpc-text outline-none',
            rest.multiline && 'min-h-[96px]',
          )}
        />
        {trailing}
      </View>
      {hasError ? (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-error" accessibilityLiveRegion="polite">
          ▲ {error}
        </Text>
      ) : hint ? (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
