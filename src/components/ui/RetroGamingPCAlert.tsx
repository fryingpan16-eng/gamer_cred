import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type RetroGamingPCAlertProps = {
  message: string;
  tone?: 'error' | 'info';
  className?: string;
};

/** Inline sunken message box for form-level errors and notices. */
export function RetroGamingPCAlert({ message, tone = 'error', className }: RetroGamingPCAlertProps) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={cn(
        'border bg-retrogamingpc-dark px-2 py-1.5',
        tone === 'error' ? 'border-retrogamingpc-error' : 'border-retrogamingpc-highlight',
        className,
      )}
    >
      <Text className={cn('text-retrogamingpc-sm', tone === 'error' ? 'text-retrogamingpc-error' : 'text-retrogamingpc-text')}>
        {tone === 'error' ? '▲ ' : 'ⓘ '}
        {message}
      </Text>
    </View>
  );
}
