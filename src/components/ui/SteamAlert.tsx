import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type SteamAlertProps = {
  message: string;
  tone?: 'error' | 'info';
  className?: string;
};

/** Inline sunken message box for form-level errors and notices. */
export function SteamAlert({ message, tone = 'error', className }: SteamAlertProps) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={cn(
        'border bg-steam-dark px-2 py-1.5',
        tone === 'error' ? 'border-steam-error' : 'border-steam-highlight',
        className,
      )}
    >
      <Text className={cn('text-steam-sm', tone === 'error' ? 'text-steam-error' : 'text-steam-text')}>
        {tone === 'error' ? '▲ ' : 'ⓘ '}
        {message}
      </Text>
    </View>
  );
}
