import { View } from 'react-native';

import { RetroGamingPCButton, RetroGamingPCInput } from '@/components/ui';
import { localToday } from '@/utils/reviewSchemas';

/** YYYY-MM-DD the day before `today`. */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localToday(d);
}

/**
 * "Date finished" for a replay (migration 000040): typed as YYYY-MM-DD, with
 * Today / Yesterday shortcuts. Validation is finishedOnSchema (reviewSchemas.ts).
 */
export function FinishedOnField({
  value,
  onChange,
  error,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <RetroGamingPCInput
        label="Date finished"
        value={value}
        onChangeText={(v) => onChange(v.replace(/[^\d-]/g, '').slice(0, 10))}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        maxLength={10}
        error={error}
        hint="Backdate it for playthroughs before GamerCred."
        editable={!disabled}
      />
      <View className="flex-row flex-wrap gap-2">
        <RetroGamingPCButton label="Today" onPress={() => onChange(localToday())} disabled={disabled} />
        <RetroGamingPCButton label="Yesterday" onPress={() => onChange(yesterday())} disabled={disabled} />
      </View>
    </View>
  );
}
