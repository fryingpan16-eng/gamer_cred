import { Pressable, Text, View } from 'react-native';

import { PlatformPicker } from '@/components/studio/PlatformPicker';
import { RetroGamingPCInput } from '@/components/ui';
import { cn } from '@/utils/cn';
import { SMART_ENTRY_TYPES, SMART_GENRES, SMART_LIST_MAX, SMART_TIERS, type SmartEntryType, type SmartTier } from '@/utils/smartLists';

/** The rule as typed: years and limit stay strings until the form is saved. */
export type SmartRuleDraft = {
  entryTypes: SmartEntryType[];
  tiers: SmartTier[];
  yearFrom: string;
  yearTo: string;
  genres: string[];
  platformId: number | null;
  limit: string;
};

export type SmartRuleErrors = Partial<Record<keyof SmartRuleDraft, string>>;

const DECADES = [1980, 1990, 2000, 2010, 2020] as const;

function Chip({ label, selected, onPress, a11y }: { label: string; selected: boolean; onPress: () => void; a11y?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      hitSlop={4}
      className={cn(
        'min-h-[28px] justify-center border px-2 py-1',
        selected ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
      )}
    >
      <Text
        className={cn('text-retrogamingpc-xs', selected ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <View className="gap-1">
      <Text className={cn('retrogamingpc-label', error && 'text-retrogamingpc-error')}>{label}</Text>
      {hint ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{hint}</Text> : null}
      {children}
      {error ? <Text className="text-retrogamingpc-xs text-retrogamingpc-error">▲ {error}</Text> : null}
    </View>
  );
}

const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** Admin smart-list rule builder: type, tier, years, genre, platform, size. */
export function SmartRuleFields({
  value,
  onChange,
  errors,
  disabled,
}: {
  value: SmartRuleDraft;
  onChange: (next: SmartRuleDraft) => void;
  errors: SmartRuleErrors;
  disabled: boolean;
}) {
  const set = (patch: Partial<SmartRuleDraft>) => onChange({ ...value, ...patch });
  const decade = DECADES.find((d) => value.yearFrom === String(d) && value.yearTo === String(d + 9)) ?? null;

  return (
    <View className="gap-3 border-l-2 border-l-retrogamingpc-highlight pl-2" pointerEvents={disabled ? 'none' : 'auto'}>
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        Ranked by Gamer Cred average. A game qualifies once it has as many ratings as the top 25% most-rated games of its type (at least 3),
        so the bar rises as the app grows. Updates by itself.
      </Text>

      <Field label="Type" error={errors.entryTypes}>
        <View className="flex-row flex-wrap gap-1">
          {SMART_ENTRY_TYPES.map((t) => (
            <Chip
              key={t.key}
              label={t.label}
              selected={value.entryTypes.includes(t.key)}
              onPress={() => set({ entryTypes: toggle(value.entryTypes, t.key) })}
            />
          ))}
        </View>
      </Field>

      <Field label="Tier" hint="None picked = any tier.">
        <View className="flex-row flex-wrap gap-1">
          {SMART_TIERS.map((t) => (
            <Chip
              key={t}
              label={t}
              a11y={`${t} tier`}
              selected={value.tiers.includes(t)}
              onPress={() => set({ tiers: toggle(value.tiers, t) })}
            />
          ))}
        </View>
      </Field>

      <Field label="Release years" hint="Leave blank for any year." error={errors.yearFrom ?? errors.yearTo}>
        <View className="flex-row flex-wrap gap-1">
          {DECADES.map((d) => (
            <Chip
              key={d}
              label={`${d}s`}
              selected={decade === d}
              onPress={() => (decade === d ? set({ yearFrom: '', yearTo: '' }) : set({ yearFrom: String(d), yearTo: String(d + 9) }))}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          <RetroGamingPCInput
            className="flex-1"
            placeholder="From"
            value={value.yearFrom}
            onChangeText={(t) => set({ yearFrom: t.replace(/\D/g, '').slice(0, 4) })}
            keyboardType="number-pad"
            accessibilityLabel="From year"
            maxLength={4}
          />
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">to</Text>
          <RetroGamingPCInput
            className="flex-1"
            placeholder="To"
            value={value.yearTo}
            onChangeText={(t) => set({ yearTo: t.replace(/\D/g, '').slice(0, 4) })}
            keyboardType="number-pad"
            accessibilityLabel="To year"
            maxLength={4}
          />
        </View>
      </Field>

      <Field label="Genre" hint="None picked = any genre. Several = games in any of them.">
        <View className="flex-row flex-wrap gap-1">
          {SMART_GENRES.map((g) => (
            <Chip
              key={g.value}
              label={g.label}
              a11y={g.value}
              selected={value.genres.includes(g.value)}
              onPress={() => set({ genres: toggle(value.genres, g.value) })}
            />
          ))}
        </View>
      </Field>

      <PlatformPicker
        label="Platform (only ratings played on it count)"
        value={value.platformId}
        onChange={(platformId) => set({ platformId })}
        noneLabel="Any platform"
      />

      <RetroGamingPCInput
        label="How many games"
        value={value.limit}
        onChangeText={(t) => set({ limit: t.replace(/\D/g, '').slice(0, 3) })}
        keyboardType="number-pad"
        hint={`Up to ${SMART_LIST_MAX}.`}
        error={errors.limit}
        maxLength={3}
      />
    </View>
  );
}
