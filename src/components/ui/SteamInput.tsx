import { useState, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { steamColors } from '@/constants/theme';
import { cn } from '@/utils/cn';

export type SteamInputProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label?: string;
  /** Validation message (e.g. from a Zod issue). Presence switches the field to error state. */
  error?: string;
  /** Muted helper text shown when there is no error. */
  hint?: string;
  /** Leading icon slot, e.g. <Feather name="search" />. */
  icon?: ReactNode;
  className?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/**
 * Sunken (inset-bevel) text field.
 * States: idle → inset bevel; focused → highlight frame; error → error frame + message.
 * The 1px border width is identical in every state so focus never shifts layout.
 */
export function SteamInput({ label, error, hint, icon, className, editable = true, ref, ...rest }: SteamInputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View className={cn('gap-1', className)}>
      {label ? (
        <Text className={cn('steam-label', hasError && 'text-steam-error')} nativeID={rest.nativeID ? `${rest.nativeID}-label` : undefined}>
          {label}
        </Text>
      ) : null}
      <View
        className={cn(
          'min-h-[26px] flex-row items-center gap-2 border bg-steam-dark px-2',
          hasError
            ? 'border-steam-error'
            : focused
              ? 'border-steam-highlight'
              : 'border-t-steam-bevel-dark border-l-steam-bevel-dark border-b-steam-bevel-light border-r-steam-bevel-light',
          !editable && 'opacity-60',
        )}
      >
        {icon ? <View className="opacity-80">{icon}</View> : null}
        <TextInput
          ref={ref}
          editable={editable}
          placeholderTextColor={steamColors.textMuted}
          selectionColor={steamColors.highlight}
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
          className="flex-1 py-1 text-steam-base text-steam-text outline-none"
        />
      </View>
      {hasError ? (
        <Text className="text-steam-xs text-steam-error" accessibilityLiveRegion="polite">
          ▲ {error}
        </Text>
      ) : hint ? (
        <Text className="text-steam-xs text-steam-text-muted">{hint}</Text>
      ) : null}
    </View>
  );
}
