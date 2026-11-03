import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCButton } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/constants/legal';
import { useIsAdmin } from '@/hooks/useLists';
import { useAdminReports } from '@/hooks/useSafety';

/** Terms, support contact, and (for admins) the moderation queue. */
export function HelpSafetySetting() {
  const isAdmin = useIsAdmin();
  return (
    <View className="gap-2">
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
        Report anything that breaks the rules with ⚑ Report on a review, list or profile. Support: <Text className="font-bold text-retrogamingpc-text-bright">{SUPPORT_EMAIL}</Text>
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <RetroGamingPCButton variant="navigate" label="Terms & Community Guidelines" onPress={() => router.push('/terms')} />
        {isAdmin.data ? <ModerationButton /> : null}
      </View>
    </View>
  );
}

function ModerationButton() {
  const open = useAdminReports('open');
  const count = open.data?.length ?? 0;
  return <RetroGamingPCButton variant="navigate" label={`Moderation queue${count > 0 ? ` (${count})` : ''}`} onPress={() => router.push('/admin/reports')} />;
}
