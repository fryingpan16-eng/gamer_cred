import { MaterialCommunityIcons } from '@expo/vector-icons';


import { RetroGamingPCButton } from './ui/RetroGamingPCButton';
import { useThemeColors } from '@/hooks/useTheme';

type GoogleSignInButtonProps = {
  label?: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function GoogleSignInButton({ label = 'Sign in with Google', loading, disabled, onPress }: GoogleSignInButtonProps) {
  const themeColors = useThemeColors();
  return (
    <RetroGamingPCButton
      label={loading ? 'Waiting for Google…' : label}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
      className="py-2"
      icon={<MaterialCommunityIcons name="google" size={14} color={themeColors.textBright} />}
      accessibilityLabel={label}
    />
  );
}
