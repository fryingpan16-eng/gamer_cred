import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useChoosePermanentName } from '@/hooks/useNames';
import { useTermsAccepted } from '@/hooks/useSafety';
import { useThemeColors } from '@/hooks/useTheme';
import { signOut } from '@/services/auth';
import { checkName, NameError } from '@/services/names';
import { usernameSchema } from '@/utils/authSchemas';
import { nameProblemMessage, PERMANENT_NAME_HINT, PERMANENT_NAME_MAX } from '@/utils/nameRules';

/**
 * Accounts that start as player_xxxxxx (Google sign-ups, or a sign-up name the
 * server turned down) pick their permanent name once, before using the app
 * (migration 000038). Shown after the Community Guidelines, never on top of them.
 */
export function ChooseNameGate() {
  const themeColors = useThemeColors();
  const profile = useAuthStore((s) => s.profile);
  const isGuest = useAuthStore((s) => s.isGuest);
  const terms = useTermsAccepted();
  const choose = useChoosePermanentName();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);

  const show = !isGuest && profile !== null && profile.username_chosen === false && terms.data === true;
  const busy = checking || choose.isPending;

  const review = async () => {
    const parsed = usernameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? PERMANENT_NAME_HINT);
      return;
    }
    setChecking(true);
    try {
      const problem = await checkName('permanent', parsed.data);
      if (problem) setError(nameProblemMessage(problem, 'permanent'));
      else {
        setName(parsed.data);
        setConfirming(true);
      }
    } catch (e) {
      setError(e instanceof NameError ? e.message : 'Could not check that name. Try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <RetroGamingPCModal visible={show} title="Choose your permanent name" onClose={() => undefined} dismissOnBackdrop={false}>
      <View className="gap-3">
        {choose.isError ? <RetroGamingPCAlert message={choose.error.message} /> : null}
        {confirming ? (
          <>
            <Text className="text-retrogamingpc-sm leading-[19px] text-retrogamingpc-text">
              Your permanent name will be{' '}
              <Text className="font-bold text-retrogamingpc-text-bright" selectable>
                @{name}
              </Text>
              . It can’t be changed later. You can set a display name any time in Settings.
            </Text>
            <View className="flex-row flex-wrap justify-end gap-2">
              <RetroGamingPCButton label="Back" onPress={() => setConfirming(false)} disabled={busy} />
              <RetroGamingPCButton
                variant="save"
                label="Confirm Name"
                loading={choose.isPending}
                onPress={() =>
                  choose.mutate(name, {
                    onError: () => setConfirming(false),
                  })
                }
              />
            </View>
          </>
        ) : (
          <>
            <Text className="text-retrogamingpc-sm leading-[19px] text-retrogamingpc-text">
              This is how players find you, and it can’t be changed later. Your display name (in Settings) can be changed
              once a day.
            </Text>
            <RetroGamingPCInput
              label="Permanent name"
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
              placeholder={profile?.username}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              maxLength={PERMANENT_NAME_MAX + 4}
              error={error ?? undefined}
              hint={PERMANENT_NAME_HINT}
              editable={!busy}
              onSubmitEditing={() => void review()}
              icon={<Feather name="user" size={12} color={themeColors.textMuted} />}
            />
            <View className="flex-row flex-wrap justify-end gap-2">
              <RetroGamingPCButton variant="cancel" label="Sign out" onPress={() => void signOut()} disabled={busy} />
              <RetroGamingPCButton variant="save" label="Continue" loading={checking} disabled={name.trim() === ''} onPress={() => void review()} />
            </View>
          </>
        )}
      </View>
    </RetroGamingPCModal>
  );
}
