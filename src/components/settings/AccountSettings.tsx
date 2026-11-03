import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCPanel } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthAction } from '@/hooks/useAuthAction';
import { useUpdateProfile } from '@/hooks/useProfile';
import { signOut } from '@/services/auth';
import type { Profile } from '@/types/database.types';
import { profileSettingsSchema, type ProfileSettingsInput } from '@/utils/profileSchemas';
import { useThemeColors } from '@/hooks/useTheme';

type FieldErrors = Partial<Record<keyof ProfileSettingsInput, string>>;

/** Username, avatar URL and sign-out. After a successful save the fields already equal the stored values. */
export function AccountSettings({ profile }: { profile: Profile }) {
  const themeColors = useThemeColors();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const logout = useAuthAction(signOut);
  const [username, setUsername] = useState(profile.username);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saved, setSaved] = useState(false);

  const dirty = username !== profile.username || avatarUrl !== (profile.avatar_url ?? '');

  const submit = () => {
    setSaved(false);
    const parsed = profileSettingsSchema.safeParse({ username, avatarUrl });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ProfileSettingsInput | undefined;
        if (key) next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    update.mutate({ current: profile, values: parsed.data }, { onSuccess: () => setSaved(true) });
  };

  return (
    <RetroGamingPCPanel
      title="Account"
      headerRight={<RetroGamingPCButton label="Sign out" loading={logout.pending} onPress={() => void logout.run()} />}
    >
      <View className="gap-3">
        {update.isError ? <RetroGamingPCAlert message={update.error.message} /> : null}
        {logout.error ? <RetroGamingPCAlert message={logout.error} /> : null}
        {saved && !dirty ? <RetroGamingPCAlert tone="info" message="Profile updated." /> : null}

        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Signed in as {user?.email ?? 'unknown'}</Text>
        <RetroGamingPCInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldErrors.username}
          hint="3–24 characters: letters, numbers, underscore"
          editable={!update.isPending}
          icon={<Feather name="user" size={12} color={themeColors.textMuted} />}
        />
        <RetroGamingPCInput
          label="Avatar URL"
          value={avatarUrl}
          onChangeText={setAvatarUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://…"
          error={fieldErrors.avatarUrl}
          hint="Leave empty to use your initial."
          editable={!update.isPending}
          icon={<Feather name="image" size={12} color={themeColors.textMuted} />}
        />
        <View className="flex-row justify-end">
          <RetroGamingPCButton label="Save Profile" variant="primary" loading={update.isPending} disabled={!dirty} onPress={submit} />
        </View>
      </View>
    </RetroGamingPCPanel>
  );
}
