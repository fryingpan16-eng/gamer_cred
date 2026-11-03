import { Feather } from '@expo/vector-icons';
import { usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import {
  RetroGamingPCAlert,
  RetroGamingPCButton,
  RetroGamingPCConfirmModal,
  RetroGamingPCInput,
  RetroGamingPCPanel,
  RetroGamingPCSaveStatus,
  saveStatusOf,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useAuthAction } from '@/hooks/useAuthAction';
import { useUpdateProfile } from '@/hooks/useProfile';
import { signOut } from '@/services/auth';
import type { Profile } from '@/types/database.types';
import { profileSettingsSchema, type ProfileSettingsInput } from '@/utils/profileSchemas';
import { useThemeColors } from '@/hooks/useTheme';

type FieldErrors = Partial<Record<keyof ProfileSettingsInput, string>>;

/**
 * Username and sign-out. The username saves only with its button; leaving
 * Settings with an unsaved edit asks first (back button, and the browser tab on web).
 */
export function AccountSettings({ profile }: { profile: Profile }) {
  const themeColors = useThemeColors();
  const { user } = useAuth();
  const update = useUpdateProfile();
  const logout = useAuthAction(signOut);
  const [username, setUsername] = useState(profile.username);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Set when leaving was blocked by an unsaved username: continues that navigation.
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [discarding, setDiscarding] = useState(false);
  // Signing out leaves Settings on purpose; never block it.
  const [signingOut, setSigningOut] = useState(false);

  const dirty = username !== profile.username;

  usePreventRemove(dirty && !discarding && !signingOut && !update.isPending, ({ repeat }) => setLeave(() => repeat));

  const submit = () => {
    const parsed = profileSettingsSchema.safeParse({ username });
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
    update.mutate({ current: profile, values: parsed.data });
  };

  return (
    <RetroGamingPCPanel
      title="Account"
      headerRight={
        <RetroGamingPCButton variant="cancel"
          label="Sign out"
          loading={logout.pending}
          onPress={() => {
            setSigningOut(true);
            void logout.run().then((result) => {
              if (!result?.ok) setSigningOut(false);
            });
          }}
        />
      }
    >
      <View className="gap-3">
        {update.isError ? <RetroGamingPCAlert message={update.error.message} /> : null}
        {logout.error ? <RetroGamingPCAlert message={logout.error} /> : null}

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
        <View className="flex-row items-center justify-end gap-3">
          {dirty && !update.isPending ? (
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Unsaved change</Text>
          ) : (
            <RetroGamingPCSaveStatus {...saveStatusOf(update)} />
          )}
          <RetroGamingPCButton variant="save" label="Save Username" loading={update.isPending} disabled={!dirty} onPress={submit} />
        </View>
      </View>

      <RetroGamingPCConfirmModal
        visible={leave !== null}
        title="Unsaved username"
        message={`You changed your username to “${username}” but haven’t saved it. Leave and discard the change?`}
        confirmLabel="Discard & Leave"
        cancelLabel="Keep Editing"
        destructive
        onCancel={() => setLeave(null)}
        onConfirm={() => {
          const go = leave;
          setDiscarding(true);
          setLeave(null);
          go?.();
        }}
      />
    </RetroGamingPCPanel>
  );
}
