import { useState } from 'react';

import { GamePickerModal } from '@/components/studio/GamePickerModal';
import { RetroGamingPCButton } from '@/components/ui';
import { useMemberId } from '@/hooks/useAuth';
import { useBacklog, useToggleBacklog } from '@/hooks/useBacklog';
import { showToast } from '@/hooks/useToastStore';

/**
 * "+ Add" for your backlog and the game picker it opens. The one add flow,
 * used by the Now Playing tab's Backlog card and your profile's Backlog card.
 */
export function BacklogAddButton() {
  const viewerId = useMemberId();
  const backlog = useBacklog(viewerId);
  const toggle = useToggleBacklog();
  const [adding, setAdding] = useState(false);
  const inBacklog = new Map((backlog.data?.gameIds ?? []).map((id) => [id, 'In backlog'] as const));

  return (
    <>
      <RetroGamingPCButton variant="create" label="+ Add" onPress={() => setAdding(true)} />
      <GamePickerModal
        visible={adding}
        title="Add to your backlog"
        closeLabel="Done"
        unavailable={inBacklog}
        onClose={() => setAdding(false)}
        onPick={(game) => {
          toggle.mutate({ gameId: game.id, inBacklog: true });
          showToast(`Added ${game.name} to your backlog`, 'success');
        }}
      />
    </>
  );
}
