import { Pressable, Text } from 'react-native';

import { ACTION_COLORS } from '@/constants/actionColors';

/** The small red ✕ in a cover's top-right corner (owner tools on cover cards). Place inside a relative box around the cover. */
export function CoverRemoveButton({ name, onPress }: { name: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${name}`}
      hitSlop={8}
      onPress={onPress}
      className="retrogamingpc-bevel absolute right-1 top-1 h-6 w-6 items-center justify-center bg-retrogamingpc-button"
    >
      <Text className="text-retrogamingpc-xs font-bold" style={{ color: ACTION_COLORS.cancel.text }}>
        ✕
      </Text>
    </Pressable>
  );
}
