import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import {
  NUMERIC_MAX,
  NUMERIC_MIN,
  RATING_SCALE_LABELS,
  ROUNDED_VALUES,
  TIER_CODES,
  type RatingScale,
} from '@/constants/ratingRubric';
import { steamColors } from '@/constants/theme';
import { cn } from '@/utils/cn';
import {
  formatRounded,
  isValidNumeric,
  storedRatingInScale,
  tierDefinition,
  toStoredRating,
  type RatingInput,
  type StoredRating,
} from '@/utils/rating';

import { SteamRating } from './SteamRating';
import { SteamStarRating } from './SteamStarRating';

export type SteamRatingInputProps = {
  label?: string;
  /** Current stored rating (may have been entered in a different scale). */
  value: StoredRating | null;
  onChange: (value: StoredRating | null) => void;
  /** The viewer's primary scale — picks the control. */
  scale: RatingScale;
  error?: string;
  className?: string;
};

function Chip({ selected, onPress, label, children }: { selected: boolean; onPress: () => void; label: string; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      className={cn('min-w-[36px] items-center justify-center border px-2 py-1', selected ? 'border-steam-text-bright' : 'border-steam-accent')}
    >
      {children}
    </Pressable>
  );
}

function NumericControl({ current, onInput }: { current: number | null; onInput: (input: RatingInput | null, error?: string) => void }) {
  const [text, setText] = useState(current === null ? '' : String(current));
  const [localError, setLocalError] = useState<string | null>(null);

  const commit = (next: string) => {
    setText(next);
    if (next.trim() === '') {
      setLocalError(null);
      onInput(null);
      return;
    }
    const n = /^\d+$/.test(next.trim()) ? Number(next.trim()) : NaN;
    if (isValidNumeric(n)) {
      setLocalError(null);
      onInput({ scale: 'numeric', value: n });
    } else {
      setLocalError(`Whole numbers ${NUMERIC_MIN}–${NUMERIC_MAX} only`);
      onInput(null, 'invalid');
    }
  };
  const step = (delta: number) => {
    const base = isValidNumeric(Number(text)) ? Number(text) : delta > 0 ? NUMERIC_MIN - 1 : NUMERIC_MAX + 1;
    commit(String(Math.min(NUMERIC_MAX, Math.max(NUMERIC_MIN, base + delta))));
  };

  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1">
        <Pressable accessibilityRole="button" accessibilityLabel="Decrease by 1" onPress={() => step(-1)} className="steam-bevel h-7 w-7 items-center justify-center bg-steam-button">
          <Text className="font-bold text-steam-text-bright">−</Text>
        </Pressable>
        <TextInput
          value={text}
          onChangeText={commit}
          keyboardType="number-pad"
          inputMode="numeric"
          maxLength={3}
          placeholder="1–100"
          placeholderTextColor={steamColors.textMuted}
          accessibilityLabel="Numeric score, 1 to 100"
          className={cn(
            'h-7 w-16 border bg-steam-dark text-center font-mono text-steam-lg font-bold text-steam-text-bright outline-none',
            localError ? 'border-steam-error' : 'border-t-steam-bevel-dark border-l-steam-bevel-dark border-b-steam-bevel-light border-r-steam-bevel-light',
          )}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Increase by 1" onPress={() => step(1)} className="steam-bevel h-7 w-7 items-center justify-center bg-steam-button">
          <Text className="font-bold text-steam-text-bright">+</Text>
        </Pressable>
        <Text className="font-mono text-steam-xs text-steam-text-muted">/ {NUMERIC_MAX}</Text>
      </View>
      {localError ? <Text className="text-steam-xs text-steam-error">▲ {localError}</Text> : null}
    </View>
  );
}

/**
 * Rating entry in the viewer's primary scale: 1–100 stepper, tier picker,
 * half-star selector, or rounded picker. Emits a StoredRating (canonical
 * numeric + exact input); other scales are shown as a live derived preview.
 */
export function SteamRatingInput({ label, value, onChange, scale, error, className }: SteamRatingInputProps) {
  const shown = value ? storedRatingInScale(value, scale) : null;
  const emit = (input: RatingInput | null) => onChange(input ? toStoredRating(input) : null);
  // Bumped on Clear so the numeric text box resets; never on keystrokes (that would drop focus).
  const [resetKey, setResetKey] = useState(0);
  const clear = () => {
    setResetKey((k) => k + 1);
    onChange(null);
  };

  return (
    <View className={cn('gap-1.5', className)}>
      <View className="flex-row items-center justify-between">
        {label ? <Text className={cn('steam-label', error && 'text-steam-error')}>{label}</Text> : <View />}
        <View className="flex-row items-center gap-2">
          <Text className="text-steam-xs text-steam-text-muted">{RATING_SCALE_LABELS[scale]}</Text>
          {value ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear rating" hitSlop={6} onPress={clear}>
              <Text className="text-steam-xs text-steam-text-muted underline">CLR</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {scale === 'numeric' ? (
        <NumericControl
          key={resetKey}
          current={shown?.scale === 'numeric' ? shown.value : null}
          onInput={(input) => emit(input)}
        />
      ) : null}

      {scale === 'tier' ? (
        <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup">
          {TIER_CODES.map((tier) => {
            const def = tierDefinition(tier);
            return (
              <Chip key={tier} label={`Tier ${tier}, ${def.descriptor}`} selected={shown?.value === tier} onPress={() => emit({ scale: 'tier', value: tier })}>
                <View className="absolute inset-0" style={{ backgroundColor: def.color, opacity: shown?.value === tier ? 1 : 0.55 }} />
                <Text className="font-mono text-steam-sm font-bold" style={{ color: def.textColor }}>
                  {tier}
                </Text>
              </Chip>
            );
          })}
        </View>
      ) : null}

      {scale === 'stars' ? (
        <SteamStarRating
          stars={(shown?.value as number | undefined) ?? null}
          size={26}
          onChange={(stars) => emit({ scale: 'stars', value: stars })}
        />
      ) : null}

      {scale === 'rounded' ? (
        <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup">
          {ROUNDED_VALUES.map((r) => (
            <Chip key={String(r)} label={formatRounded(r)} selected={shown?.value === r} onPress={() => emit({ scale: 'rounded', value: r })}>
              <Text className={cn('font-mono text-steam-sm font-bold', shown?.value === r ? 'text-steam-text-bright' : 'text-steam-text-muted')}>
                {r}
              </Text>
            </Chip>
          ))}
        </View>
      ) : null}

      {/* Live preview: tier badge + every derived scale. */}
      {value ? <SteamRating rating={value} scale={scale} expanded /> : null}
      {error ? <Text className="text-steam-xs text-steam-error">▲ {error}</Text> : null}
    </View>
  );
}
