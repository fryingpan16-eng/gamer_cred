import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addListItem,
  createList,
  deleteList,
  fetchIsAdmin,
  fetchList,
  fetchPinnedLists,
  fetchRecentLists,
  fetchUserLists,
  listSearchPattern,
  moveListItem,
  removeListItem,
  searchLists,
  setListPin,
  updateList,
  type ListDetail,
  fetchSmartListGames,
} from '@/services/lists';
import type { ListFormValues } from '@/utils/listSchemas';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';
import { showToast } from './useToastStore';

function useViewerId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

/** Admin-curated lists pinned to the Home tab. */
export function usePinnedLists() {
  return useQuery({ queryKey: queryKeys.lists.pinned(), queryFn: fetchPinnedLists, staleTime: 5 * 60_000 });
}

/** Recently updated public lists (Home → Lists → Browse, before searching). */
export function useRecentLists() {
  return useQuery({ queryKey: queryKeys.lists.recent(), queryFn: () => fetchRecentLists(), staleTime: 2 * 60_000 });
}

export function useUserLists(userId: string | null) {
  return useQuery({ queryKey: queryKeys.lists.byUser(userId ?? 'none'), queryFn: () => fetchUserLists(userId!), enabled: userId !== null });
}

export function useList(listId: string | null) {
  return useQuery({ queryKey: queryKeys.lists.detail(listId ?? 'none'), queryFn: () => fetchList(listId!), enabled: listId !== null });
}

/** Public list search (Search tab → Lists). */
export function useListSearch(term: string) {
  const enabled = listSearchPattern(term) !== null;
  return useQuery({
    queryKey: queryKeys.lists.search(term.trim().toLowerCase()),
    queryFn: () => searchLists(term),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** A smart list's games, live from Gamer Cred ratings. Pass enabled=false for hand-picked lists. */
export function useSmartListGames(listId: string | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.lists.smart(listId ?? 'none'),
    queryFn: () => fetchSmartListGames(listId!),
    enabled: enabled && listId !== null,
    staleTime: 5 * 60_000,
  });
}

/** Whether the viewer is an app admin (may pin lists to Home). */
export function useIsAdmin() {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.lists.isAdmin(viewerId ?? 'none'),
    queryFn: fetchIsAdmin,
    enabled: viewerId !== null,
    staleTime: 10 * 60_000,
  });
}

/** Smart list results come from ratings (smart_list_cache), so list edits never change them. */
const notSmart = (q: { queryKey: readonly unknown[] }) => q.queryKey[2] !== 'smart';

function useInvalidateLists() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all(), predicate: notSmart });
}

export function useCreateList() {
  const viewerId = useViewerId();
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (values: ListFormValues) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return createList(viewerId, values);
    },
    onSettled: invalidate,
  });
}

export function useUpdateList(listId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: (values: ListFormValues) => updateList(listId, values),
    onSettled: () => {
      invalidate();
      // A changed rule changes this smart list's games.
      void queryClient.invalidateQueries({ queryKey: queryKeys.lists.smart(listId) });
    },
  });
}

export function useDeleteList() {
  const invalidate = useInvalidateLists();
  return useMutation({ mutationFn: (listId: string) => deleteList(listId), onSettled: invalidate });
}

export type ListItemAction =
  | { action: 'add'; gameId: number }
  | { action: 'remove'; gameId: number }
  /** 1-based target position. */
  | { action: 'move'; gameId: number; to: number };

/** Pure: the list's game order after an action (used for the optimistic update; unit-tested). */
export function applyListItemAction(gameIds: readonly number[], a: ListItemAction): number[] {
  switch (a.action) {
    case 'add':
      return gameIds.includes(a.gameId) ? [...gameIds] : [...gameIds, a.gameId];
    case 'remove':
      return gameIds.filter((id) => id !== a.gameId);
    case 'move': {
      if (!gameIds.includes(a.gameId)) return [...gameIds];
      const rest = gameIds.filter((id) => id !== a.gameId);
      const at = Math.max(0, Math.min(rest.length, a.to - 1));
      return [...rest.slice(0, at), a.gameId, ...rest.slice(at)];
    }
  }
}

/** Add / remove / reorder games, updating the list on screen first (rolled back on failure). */
export function useListItems(listId: string) {
  const queryClient = useQueryClient();
  const key = queryKeys.lists.detail(listId);
  return useMutation({
    // One at a time per list, so rapid ▲▼ taps apply in order.
    scope: { id: `list-items:${listId}` },
    mutationFn: (a: ListItemAction) =>
      a.action === 'add'
        ? addListItem(listId, a.gameId)
        : a.action === 'remove'
          ? removeListItem(listId, a.gameId)
          : moveListItem(listId, a.gameId, a.to),
    onMutate: async (a) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ListDetail | null>(key);
      if (previous) {
        const gameIds = applyListItemAction(previous.gameIds, a);
        queryClient.setQueryData<ListDetail>(key, { ...previous, gameIds, gameCount: gameIds.length, previewGameIds: gameIds.slice(0, 4) });
      }
      return { previous };
    },
    onError: (error, _a, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      showToast(error.message, 'error');
    },
    onSettled: () => {
      // This list (and its owner's list of lists) refetch now; other list views refresh when next shown.
      const ownerId = queryClient.getQueryData<ListDetail | null>(key)?.userId;
      void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all(), predicate: notSmart, refetchType: 'none' });
      void queryClient.invalidateQueries({ queryKey: key });
      if (ownerId) void queryClient.invalidateQueries({ queryKey: queryKeys.lists.byUser(ownerId) });
    },
  });
}

export function useSetListPin() {
  const invalidate = useInvalidateLists();
  return useMutation({
    mutationFn: ({ listId, rank }: { listId: string; rank: number | null }) => setListPin(listId, rank),
    onError: (error) => showToast(error.message, 'error'),
    onSettled: invalidate,
  });
}
