import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchBacklog, setBacklogEntry, updateBacklogVisibility, type BacklogVisibility } from '@/services/backlog';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore, useMemberId } from './useAuth';
import { showToast } from './useToastStore';

type BacklogData = { gameIds: number[]; total: number };

/** A player's backlog, newest first. */
export function useBacklog(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.backlog.byUser(userId ?? 'none'),
    queryFn: () => fetchBacklog(userId!),
    enabled: userId !== null,
    staleTime: 60_000,
  });
}

/** Add to / remove from your backlog — instant, rolled back with a message if it fails. */
export function useToggleBacklog() {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  const key = queryKeys.backlog.byUser(viewerId ?? 'none');
  return useMutation({
    mutationFn: ({ gameId, inBacklog }: { gameId: number; inBacklog: boolean }) => {
      if (!viewerId) throw new Error('Create a free account to keep a backlog.');
      return setBacklogEntry(viewerId, gameId, inBacklog);
    },
    onMutate: async ({ gameId, inBacklog }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<BacklogData>(key);
      if (previous) {
        const has = previous.gameIds.includes(gameId);
        if (inBacklog && !has)
          queryClient.setQueryData<BacklogData>(key, { gameIds: [gameId, ...previous.gameIds], total: previous.total + 1 });
        if (!inBacklog && has)
          queryClient.setQueryData<BacklogData>(key, { gameIds: previous.gameIds.filter((g) => g !== gameId), total: previous.total - 1 });
      }
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      showToast(error.message, 'error');
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

/** Public / private for your backlog (stored on your profile). */
export function useUpdateBacklogVisibility() {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  return useMutation({
    mutationFn: (visibility: BacklogVisibility) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return updateBacklogVisibility(viewerId, visibility);
    },
    onMutate: (visibility) => {
      const previous = useAuthStore.getState().profile;
      if (previous) useAuthStore.setState({ profile: { ...previous, backlog_visibility: visibility } });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) useAuthStore.setState({ profile: ctx.previous });
    },
    onSuccess: (profile) => {
      useAuthStore.setState({ profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all() });
    },
  });
}
