import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCSaveStatus, type RetroGamingPCTabItem, RetroGamingPCTabs, saveStatusOf } from '@/components/ui';
import { RATING_SCALES, type RatingScale } from '@/constants/ratingRubric';
import { usePrimaryRatingScale } from '@/hooks/useAuth';
import { useUpdatePrimaryRatingScale } from '@/hooks/useProfile';

const SCALE_TABS: readonly RetroGamingPCTabItem<RatingScale>[] = RATING_SCALES.map((key) => ({
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
export function RatingScaleSetting() {
  // Read from the auth snapshot, which the mutation updates optimistically.
  const value = usePrimaryRatingScale();
  const update = useUpdatePrimaryRatingScale();
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="retrogamingpc-label">Primary rating scale</Text>
        <RetroGamingPCSaveStatus {...saveStatusOf(update)} />
      </View>
      <RetroGamingPCTabs items={SCALE_TABS} value={value} onChange={(scale) => update.mutate(scale)} fill />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text">{SCALE_EXAMPLES[value]}</Text>
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        The other scales are worked out automatically. Changing this only affects how you enter and see ratings from now
        on; ratings you already saved are kept exactly as entered.
      </Text>
      {update.isError ? <RetroGamingPCAlert message={update.error.message} /> : null}
    </View>
  );
}
