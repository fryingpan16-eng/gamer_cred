import { Text } from 'react-native';

import { cn } from '@/utils/cn';

/** "×3" next to a game a player has replayed (migration 000040): plays = replays + 1. Nothing for one play. */
export function PlaysTag({ replays, className }: { replays: number; className?: string }) {
  if (replays < 1) return null;
  const plays = replays + 1;
  return (
    <Text
      className={cn('font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-muted', className)}
      accessibilityLabel={`played ${plays} times`}
    >
      {` ↻×${plays}`}
    </Text>
  );
}
