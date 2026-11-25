import { Pressable, Text } from 'react-native';

import { cn } from '@/utils/cn';

/** A small choice chip (Library filters, format, sort), styled like the platform picker's chips. */
export function LibraryChip({
  label,
  selected,
  onPress,
  accessibilityLabel,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      className={cn(
        'min-h-[28px] justify-center border px-2 py-1',
        selected ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
        disabled && 'opacity-50',
      )}
    >
      <Text className={cn('text-retrogamingpc-xs', selected ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}>
        {label}
      </Text>
    </Pressable>
  );
}
