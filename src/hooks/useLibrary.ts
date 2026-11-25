import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addLibraryCopies,
  fetchLibrary,
  removeLibraryCopy,
  setLibraryFormat,
  updateLibraryVisibility,
  type LibraryCopyInput,
  type LibraryVisibility,
} from '@/services/library';
import type { LibraryEntry, LibraryFormat } from '@/utils/library';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore, useMemberId } from './useAuth';
import { showToast } from './useToastStore';

/** A player's Library, newest first. Pass null to skip (e.g. someone's private Library). */
export function useLibrary(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.library.byUser(userId ?? 'none'),
    queryFn: () => fetchLibrary(userId!),
    enabled: userId !== null,
    staleTime: 60_000,
  });
}

/** Your copies of one game (empty while loading). */
export function useMyLibraryCopies(gameId: number) {
  const viewerId = useMemberId();
  const library = useLibrary(viewerId);
  return { copies: (library.data ?? []).filter((e) => e.gameId === gameId), isPending: viewerId !== null && library.isPending };
}

/**
 * Change your Library: add copies, remove a copy (or every copy of a game),
 * set a copy's format. The screen updates straight away; a failure rolls it
 * back with a message.
 */
export function useLibraryMutations() {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  const key = queryKeys.library.byUser(viewerId ?? 'none');

  const optimistic = async (change: (old: LibraryEntry[]) => LibraryEntry[]) => {
    await queryClient.cancelQueries({ queryKey: key });
    const previous = queryClient.getQueryData<LibraryEntry[]>(key);
    if (previous) queryClient.setQueryData<LibraryEntry[]>(key, change(previous));
    return { previous };
  };
  const rollback = (error: Error, context: { previous?: LibraryEntry[] } | undefined) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous);
    showToast(error.message, 'error');
  };
  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: key });
    if (viewerId) void queryClient.invalidateQueries({ queryKey: queryKeys.stats.byUser(viewerId) });
  };
  const requireMember = () => {
    if (!viewerId) throw new Error('Create a free account to keep a library.');
    return viewerId;
  };

  const add = useMutation({
    mutationFn: (copies: LibraryCopyInput[]) => addLibraryCopies(requireMember(), copies),
    onMutate: (copies) =>
      optimistic((old) => {
        const fresh = copies
          .filter((c) => !old.some((e) => e.gameId === c.gameId && e.platformId === c.platformId))
          .map(
            (c): LibraryEntry => ({
              ...c,
              source: 'manual',
              addedAt: new Date().toISOString(),
              // Filled in on the refetch; the page falls back to looked-up names meanwhile.
              name: null,
              releaseYear: null,
              generation: old.find((e) => e.platformId === c.platformId)?.generation ?? null,
              rating: old.find((e) => e.gameId === c.gameId)?.rating ?? null,
            }),
          );
        return [...fresh, ...old];
      }),
    onError: (error, _vars, context) => rollback(error, context),
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: ({ gameId, platformId }: { gameId: number; platformId: number | null }) => removeLibraryCopy(requireMember(), gameId, platformId),
    onMutate: ({ gameId, platformId }) =>
      optimistic((old) => old.filter((e) => !(e.gameId === gameId && (platformId === null || e.platformId === platformId)))),
    onError: (error, _vars, context) => rollback(error, context),
    onSettled: settle,
  });

  const setFormat = useMutation({
    mutationFn: ({ gameId, platformId, format }: { gameId: number; platformId: number; format: LibraryFormat | null }) =>
      setLibraryFormat(requireMember(), gameId, platformId, format),
    onMutate: ({ gameId, platformId, format }) =>
      optimistic((old) => old.map((e) => (e.gameId === gameId && e.platformId === platformId ? { ...e, format } : e))),
    onError: (error, _vars, context) => rollback(error, context),
    onSettled: settle,
  });

  return { add, remove, setFormat };
}

/** Private / public for your whole Library (stored on your profile). */
export function useUpdateLibraryVisibility() {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  return useMutation({
    mutationFn: (visibility: LibraryVisibility) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return updateLibraryVisibility(viewerId, visibility);
    },
    onMutate: (visibility) => {
      const previous = useAuthStore.getState().profile;
      if (previous) useAuthStore.setState({ profile: { ...previous, library_visibility: visibility } });
      return { previous };
    },
    onError: (error, _v, ctx) => {
      if (ctx?.previous) useAuthStore.setState({ profile: ctx.previous });
      showToast(error.message, 'error');
    },
    onSuccess: (profile) => {
      useAuthStore.setState({ profile });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all() });
    },
  });
}
