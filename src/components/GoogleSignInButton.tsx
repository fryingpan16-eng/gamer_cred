import { MaterialCommunityIcons } from '@expo/vector-icons';

import { steamColors } from '@/constants/theme';

import { SteamButton } from './ui/SteamButton';

type GoogleSignInButtonProps = {
  label?: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function GoogleSignInButton({ label = 'Sign in with Google', loading, disabled, onPress }: GoogleSignInButtonProps) {
  return (
    <SteamButton
      label={loading ? 'Waiting for Google…' : label}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      className="py-2"
      icon={<MaterialCommunityIcons name="google" size={14} color={steamColors.textBright} />}
      accessibilityLabel={label}
    />
  );
}
