import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type RetroGamingPCCheckboxProps = {
  checked: boolean;
  label: string;
  /** Optional muted explanation under the label. */
  description?: string;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
};

/** Sunken retro checkbox with label (and optional description). */
export function RetroGamingPCCheckbox({ checked, label, description, onToggle, disabled = false, className }: RetroGamingPCCheckboxProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      accessibilityHint={description}
      disabled={disabled}
      onPress={onToggle}
      className={cn('flex-row items-start gap-2', disabled && 'opacity-50', className)}
    >
      <View className="retrogamingpc-bevel-inset mt-px h-4 w-4 items-center justify-center bg-retrogamingpc-dark">
        {checked ? <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-highlight">✓</Text> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text">{label}</Text>
        {description ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{description}</Text> : null}
      </View>
    </Pressable>
  );
}
