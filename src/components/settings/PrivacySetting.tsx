import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCSaveStatus, type RetroGamingPCTabItem, RetroGamingPCTabs, saveStatusOf } from '@/components/ui';
import {
  DEFAULT_NOW_PLAYING_VISIBILITY,
  NOW_PLAYING_VISIBILITIES,
  NOW_PLAYING_VISIBILITY_OPTIONS,
  type NowPlayingVisibility,
} from '@/constants/privacy';
import { useAuthStore } from '@/hooks/useAuth';
import { useUpdateBacklogVisibility } from '@/hooks/useBacklog';
import { useUpdateNowPlayingVisibility } from '@/hooks/useProfile';
import type { BacklogVisibility } from '@/services/backlog';

const BACKLOG_TABS: readonly RetroGamingPCTabItem<BacklogVisibility>[] = [
  { key: 'public', label: 'Public' },
  { key: 'private', label: 'Private' },
];

const TABS: readonly RetroGamingPCTabItem<NowPlayingVisibility>[] = NOW_PLAYING_VISIBILITIES.map((key) => ({
  key,
  label: NOW_PLAYING_VISIBILITY_OPTIONS[key].label,
}));

/**
 * Who can see your Now Playing. Enforced server-side (RLS, migration 000010):
 * anyone not allowed gets no rows — on your profile and in activity feeds.
 * You always see your own slots.
 */
export function PrivacySetting() {
  const visibility = useAuthStore((s) => s.profile?.now_playing_visibility ?? DEFAULT_NOW_PLAYING_VISIBILITY);
  const update = useUpdateNowPlayingVisibility();
  const backlogVisibility = useAuthStore((s) => s.profile?.backlog_visibility ?? 'public');
  const backlog = useUpdateBacklogVisibility();

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="retrogamingpc-label">Who can see my Now Playing</Text>
        <RetroGamingPCSaveStatus {...saveStatusOf(update)} />
      </View>
      <RetroGamingPCTabs items={TABS} value={visibility} onChange={(v) => v !== visibility && update.mutate(v)} fill />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text">{NOW_PLAYING_VISIBILITY_OPTIONS[visibility].description}</Text>
      {update.isError ? <RetroGamingPCAlert message={update.error.message} /> : null}

      <View className="mt-2 flex-row items-center justify-between gap-2">
        <Text className="retrogamingpc-label">Who can see my Backlog</Text>
        <RetroGamingPCSaveStatus {...saveStatusOf(backlog)} />
      </View>
      <RetroGamingPCTabs
        items={BACKLOG_TABS}
        value={backlogVisibility}
        onChange={(v) => v !== backlogVisibility && backlog.mutate(v)}
        fill
      />
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text">
        {backlogVisibility === 'public' ? 'Signed-in players can see your backlog on your profile.' : 'Only you can see your backlog.'}
      </Text>
      {backlog.isError ? <RetroGamingPCAlert message={backlog.error.message} /> : null}
    </View>
  );
}
