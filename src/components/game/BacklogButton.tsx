import { RetroGamingPCButton } from '@/components/ui';
import { useMemberId } from '@/hooks/useAuth';
import { useBacklog, useToggleBacklog } from '@/hooks/useBacklog';
import { showToast } from '@/hooks/useToastStore';

/** + Backlog on the game page (games leave the backlog once you rate them). */
export function BacklogButton({ gameId, gameName }: { gameId: number; gameName: string }) {
  const viewerId = useMemberId();
  const backlog = useBacklog(viewerId);
  const toggle = useToggleBacklog();
  const inBacklog = backlog.data?.gameIds.includes(gameId) ?? false;
  return (
    <RetroGamingPCButton
      variant={inBacklog ? 'default' : 'create'}
      label={inBacklog ? '✓ In backlog' : '+ Backlog'}
      accessibilityLabel={inBacklog ? `Remove ${gameName} from your backlog` : `Add ${gameName} to your backlog`}
      accessibilityState={{ selected: inBacklog }}
      disabled={backlog.isPending}
      onPress={() => {
        toggle.mutate({ gameId, inBacklog: !inBacklog });
        showToast(
          inBacklog ? `Removed ${gameName} from your backlog` : `Added ${gameName} to your backlog`,
          inBacklog ? 'info' : 'success',
        );
      }}
    />
  );
}
