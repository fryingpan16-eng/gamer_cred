import { Pressable, Text } from 'react-native';

type SteamButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

/** Raised bevel button that sinks (inverted bevel) while pressed. */
export function SteamButton({ label, onPress, disabled = false }: SteamButtonProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}>
      {({ pressed }) => (
        <Text
          className={`${pressed ? 'steam-button-pressed' : 'steam-button'} text-steam-text-bright text-steam-base ${
            disabled ? 'opacity-50' : ''
          }`}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
