import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type SteamScoreMeterProps = {
  label?: string;
  value: number | null;
  onChange?: (value: number | null) => void;
  max?: number;
  error?: string;
  /** Compact read-only variant for cards. */
  size?: 'regular' | 'compact';
  className?: string;
};

/**
 * Retro segmented 1–10 score meter (think old Steam download bars).
 * Tap a segment to set; tap the current value again (or "CLR") to clear.
 */
export function SteamScoreMeter({
  label,
  value,
  onChange,
  max = 10,
  error,
  size = 'regular',
  className,
}: SteamScoreMeterProps) {
  const interactive = Boolean(onChange);
  const compact = size === 'compact';

  return (
    <View className={cn('gap-1', className)}>
      {label ? <Text className={cn('steam-label', error && 'text-steam-error')}>{label}</Text> : null}
      <View className="flex-row items-center gap-2">
        <View
          className={cn('steam-bevel-inset flex-1 flex-row gap-px bg-steam-dark p-px', error && 'border-steam-error')}
          accessibilityRole={interactive ? 'adjustable' : 'progressbar'}
          accessibilityLabel={label ?? 'Score'}
          accessibilityValue={{ min: 0, max, now: value ?? 0, text: value === null ? 'No score' : `${value} out of ${max}` }}
          accessibilityActions={interactive ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
          onAccessibilityAction={(e) => {
            if (!onChange) return;
            const current = value ?? 0;
            if (e.nativeEvent.actionName === 'increment') onChange(Math.min(max, current + 1));
            if (e.nativeEvent.actionName === 'decrement') onChange(current <= 1 ? null : current - 1);
          }}
        >
          {Array.from({ length: max }, (_, i) => {
            const segment = i + 1;
            const filled = value !== null && segment <= value;
            const cell = (
              <View
                className={cn(
                  'flex-1',
                  compact ? 'h-1.5' : 'h-5',
                  filled ? (segment >= 8 ? 'bg-steam-highlight' : 'bg-steam-active') : 'bg-steam-card',
                )}
              />
            );
            return interactive ? (
              <Pressable
                key={segment}
                className="flex-1"
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityElementsHidden
                importantForAccessibility="no"
                onPress={() => onChange?.(value === segment ? null : segment)}
              >
                {cell}
              </Pressable>
            ) : (
              <View key={segment} className="flex-1">
                {cell}
              </View>
            );
          })}
        </View>
        <Text
          className={cn(
            'min-w-[38px] text-right font-mono font-bold',
            compact ? 'text-steam-xs' : 'text-steam-base',
            value === null ? 'text-steam-text-muted' : 'text-steam-text-bright',
          )}
        >
          {value === null ? '--' : value}/{max}
        </Text>
        {interactive && value !== null ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear score" hitSlop={6} onPress={() => onChange?.(null)}>
            <Text className="text-steam-xs text-steam-text-muted underline">CLR</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text className="text-steam-xs text-steam-error">▲ {error}</Text> : null}
    </View>
  );
}
