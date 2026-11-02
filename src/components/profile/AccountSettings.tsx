import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { SteamAlert, SteamButton, SteamInput, SteamPanel, SteamTabs, type SteamTabItem } from '@/components/ui';
import { RATING_SCALES, type RatingScale } from '@/constants/ratingRubric';
import { steamColors } from '@/constants/theme';
import { useAuth, usePrimaryRatingScale } from '@/hooks/useAuth';
import { useAuthAction } from '@/hooks/useAuthAction';
import { useUpdatePrimaryRatingScale, useUpdateProfile } from '@/hooks/useProfile';
import { signOut } from '@/services/auth';
import type { Profile } from '@/types/database.types';
import { profileSettingsSchema, type ProfileSettingsInput } from '@/utils/profileSchemas';

type FieldErrors = Partial<Record<keyof ProfileSettingsInput, string>>;

const SCALE_TABS: readonly SteamTabItem<RatingScale>[] = RATING_SCALES.map((key) => ({
  key,
  label: { numeric: '1–100', tier: 'Tier', stars: 'Stars', rounded: 'Rounded' }[key],
}));

const SCALE_EXAMPLES: Record<RatingScale, string> = {
  numeric: 'Rate with an exact score from 1 to 100.',
  tier: 'Rate with a tier: S**, S, A+, A, B, C, D or F.',
  stars: 'Rate with ½ to 5 stars.',
  rounded: 'Rate with 5–10, or NOT GOOD.',
};

/** Primary rating scale: saved immediately; existing ratings keep how they were entered. */
function RatingScaleSetting() {
  // Read from the auth snapshot, which the mutation updates optimistically.
  const value = usePrimaryRatingScale();
  const update = useUpdatePrimaryRatingScale();
  return (
    <View className="gap-1.5 border-t border-t-steam-accent pt-3">
      <Text className="steam-label">Primary rating scale</Text>
      <SteamTabs items={SCALE_TABS} value={value} onChange={(scale) => update.mutate(scale)} fill />
      <Text className="text-steam-xs text-steam-text">{SCALE_EXAMPLES[value]}</Text>
      <Text className="text-steam-xs text-steam-text-muted">
        The other scales are worked out automatically. Changing this only affects how you enter and see ratings from now
        on; ratings you already saved are kept exactly as entered.
      </Text>
      {update.isError ? <SteamAlert message={update.error.message} /> : null}
    </View>
  );
}

/** Username, avatar URL and sign-out. After a successful save the fields already equal the stored values. */
export function AccountSettings({ profile }: { profile: Profile }) {
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
    <SteamPanel
      title="Account"
      headerRight={<SteamButton label="Sign out" loading={logout.pending} onPress={() => void logout.run()} />}
    >
      <View className="gap-3">
        {update.isError ? <SteamAlert message={update.error.message} /> : null}
        {logout.error ? <SteamAlert message={logout.error} /> : null}
        {saved && !dirty ? <SteamAlert tone="info" message="Profile updated." /> : null}

        <Text className="text-steam-xs text-steam-text-muted">Signed in as {user?.email ?? 'unknown'}</Text>
        <SteamInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          error={fieldErrors.username}
          hint="3–24 characters: letters, numbers, underscore"
          editable={!update.isPending}
          icon={<Feather name="user" size={12} color={steamColors.textMuted} />}
        />
        <SteamInput
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
          icon={<Feather name="image" size={12} color={steamColors.textMuted} />}
        />
        <View className="flex-row justify-end">
          <SteamButton label="Save Profile" variant="primary" loading={update.isPending} disabled={!dirty} onPress={submit} />
        </View>
        <RatingScaleSetting />
      </View>
    </SteamPanel>
  );
}
