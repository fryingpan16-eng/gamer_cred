import { useState } from 'react';
import { Text } from 'react-native';

import { cn } from '@/utils/cn';
import { timeAgo } from '@/utils/time';

export type RetroGamingPCTimeAgoProps = {
  iso: string;
  /** Text after the time, e.g. " · edited". */
  suffix?: string;
  /** Tap behaviour of whatever this sits in (a long-press-able Text takes the tap). */
  onPress?: () => void;
  className?: string;
};

export const fullDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "3 days ago" everywhere; long-press shows the full date and time. */
export function RetroGamingPCTimeAgo({ iso, suffix = '', onPress, className }: RetroGamingPCTimeAgoProps) {
  const [full, setFull] = useState(false);
  return (
    <Text
      accessibilityLabel={`${fullDate(iso)}${suffix}`}
      accessibilityHint="Long-press to switch between the full date and how long ago"
      onLongPress={() => setFull((f) => !f)}
      onPress={onPress}
      className={cn('text-retrogamingpc-xs text-retrogamingpc-text-muted', className)}
    >
      {full ? fullDate(iso) : timeAgo(iso)}
      {suffix}
    </Text>
  );
}
