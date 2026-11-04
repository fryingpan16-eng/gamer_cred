import { RetroGamingPCButton } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useUpdateBacklogVisibility } from '@/hooks/useBacklog';

/** 🔓 Public / 🔒 Private for your backlog — one tap to switch (also in Settings → Privacy). */
export function BacklogPrivacyToggle() {
  const visibility = useAuthStore((s) => s.profile?.backlog_visibility ?? 'public');
  const update = useUpdateBacklogVisibility();
  const isPublic = visibility === 'public';
  return (
    <RetroGamingPCButton
      label={isPublic ? '🔓 Public' : '🔒 Private'}
      accessibilityLabel={`Backlog is ${isPublic ? 'public' : 'private'}. Tap to make it ${isPublic ? 'private' : 'public'}`}
      disabled={update.isPending}
      onPress={() => update.mutate(isPublic ? 'private' : 'public')}
    />
  );
}
