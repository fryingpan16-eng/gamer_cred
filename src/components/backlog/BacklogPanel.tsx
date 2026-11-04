import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { CoverShowcase, SHOWCASE_PREVIEW } from '@/components/games/CoverShowcase';
import { RetroGamingPCButton } from '@/components/ui';
import { useMemberId } from '@/hooks/useAuth';
import { useBacklog, useToggleBacklog } from '@/hooks/useBacklog';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { showToast } from '@/hooks/useToastStore';

import { BacklogAddButton } from './BacklogAddButton';
import { BacklogPrivacyToggle } from './BacklogPrivacyToggle';

/**
 * Your backlog on the Now Playing page (between Now Playing and Review Studio):
 * add games, remove them, switch public / private. Games leave it once you rate them.
 */
export function BacklogPanel() {
  const viewerId = useMemberId();
  const backlog = useBacklog(viewerId);
  const nowPlaying = useNowPlaying();
  const toggle = useToggleBacklog();
  const ids = backlog.data?.gameIds ?? [];
  const total = backlog.data?.total ?? 0;
  const playing = new Set((nowPlaying.data ?? []).map((r) => r.game_id));

  return (
    <CoverShowcase
      title={`Backlog${backlog.data ? ` (${total})` : ''}`}
      gameIds={ids}
      isPending={backlog.isPending}
      error={backlog.error}
      headerRight={
        <View className="flex-row gap-2">
          <BacklogPrivacyToggle />
          <BacklogAddButton />
        </View>
      }
      tagFor={(id) => (playing.has(id) ? 'Now Playing' : null)}
      onRemove={(id, name) => {
        toggle.mutate({ gameId: id, inBacklog: false });
        showToast(`Removed ${name} from your backlog`, 'info');
      }}
      empty={
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          Games you want to play next. Add them here or with + Backlog on any game page. They leave the backlog once you rate them.
        </Text>
      }
      footer={
        total > SHOWCASE_PREVIEW && viewerId ? (
          <View className="flex-row justify-end">
            <RetroGamingPCButton
              variant="navigate"
              label={`View all ${total}`}
              onPress={() => router.push({ pathname: '/backlog/[userId]', params: { userId: viewerId } })}
            />
          </View>
        ) : undefined
      }
    />
  );
}
