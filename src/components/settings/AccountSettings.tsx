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
import { OfficialBadge, useShownName } from '@/components/user/UserName';
import { useAuth } from '@/hooks/useAuth';
import { useAuthAction } from '@/hooks/useAuthAction';
import { useUpdateDisplayName } from '@/hooks/useNames';
import { useThemeColors } from '@/hooks/useTheme';
import { signOut } from '@/services/auth';
import { checkName, NameError, nextDisplayNameChange } from '@/services/names';
import type { Profile } from '@/types/database.types';
import { DISPLAY_NAME_HINT, DISPLAY_NAME_MAX, nameProblemMessage } from '@/utils/nameRules';
import { profileSettingsSchema } from '@/utils/profileSchemas';

const fmtWhen = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Permanent name (read-only, migration 000038), display name and sign-out. The
 * display name saves only with its button and can change once a day; leaving
 * Settings with an unsaved edit asks first (back button, and the browser tab on web).
 */
export function AccountSettings({ profile }: { profile: Profile }) {
  const themeColors = useThemeColors();
  const { user } = useAuth();
  const update = useUpdateDisplayName();
  const logout = useAuthAction(signOut);
  const { isOfficial } = useShownName(profile.id, profile.username);
  const saved = profile.display_name ?? '';
  const [displayName, setDisplayName] = useState(saved);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Set when leaving was blocked by an unsaved edit: continues that navigation.
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const [discarding, setDiscarding] = useState(false);
  // Signing out leaves Settings on purpose; never block it.
  const [signingOut, setSigningOut] = useState(false);

  const nextChange = nextDisplayNameChange(profile);
  const dirty = displayName.trim() !== saved;
  const busy = update.isPending || checking;

  usePreventRemove(dirty && !discarding && !signingOut && !busy, ({ repeat }) => setLeave(() => repeat));

  const submit = async () => {
    const parsed = profileSettingsSchema.safeParse({ displayName });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? DISPLAY_NAME_HINT);
      return;
    }
    const next = parsed.data.displayName;
    setFieldError(null);
    if (next !== '') {
      setChecking(true);
      try {
        const problem = await checkName('display', next);
        if (problem) {
          setFieldError(nameProblemMessage(problem, 'display'));
          return;
        }
      } catch (e) {
        setFieldError(e instanceof NameError ? e.message : 'Could not check that name. Try again.');
        return;
      } finally {
        setChecking(false);
      }
    }
    update.mutate(next === '' ? null : next, { onSuccess: (p) => setDisplayName(p.display_name ?? '') });
  };

  return (
    <RetroGamingPCPanel
      title="Account"
      headerRight={
        <RetroGamingPCButton
          variant="cancel"
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

        <View className="gap-0.5">
          <Text className="text-retrogamingpc-xs font-bold uppercase text-retrogamingpc-text-muted">Permanent name</Text>
          <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" selectable>
            @{profile.username}
            {isOfficial ? (
              <>
                {' '}
                <OfficialBadge />
              </>
            ) : null}
          </Text>
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            Players find you by this name. It can’t be changed.
          </Text>
        </View>

        <RetroGamingPCInput
          label="Display name"
          value={displayName}
          onChangeText={(v) => {
            setDisplayName(v);
            setFieldError(null);
          }}
          placeholder={profile.username}
          autoCorrect={false}
          maxLength={DISPLAY_NAME_MAX + 8}
          error={fieldError ?? undefined}
          hint={
            nextChange
              ? `You can change it again after ${fmtWhen(nextChange)}.`
              : `${DISPLAY_NAME_HINT} Leave it empty to show @${profile.username}.`
          }
          editable={!busy && !nextChange}
          icon={<Feather name="user" size={12} color={themeColors.textMuted} />}
        />
        <View className="flex-row flex-wrap items-center justify-end gap-3">
          {dirty && !busy ? (
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Unsaved change</Text>
          ) : (
            <RetroGamingPCSaveStatus {...saveStatusOf(update)} />
          )}
          <RetroGamingPCButton
            variant="save"
            label="Save Display Name"
            loading={busy}
            disabled={!dirty || nextChange !== null}
            onPress={() => void submit()}
          />
        </View>
      </View>

      <RetroGamingPCConfirmModal
        visible={leave !== null}
        title="Unsaved display name"
        message={`You changed your display name to “${displayName.trim() || profile.username}” but haven’t saved it. Leave and discard the change?`}
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
