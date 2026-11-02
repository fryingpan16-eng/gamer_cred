import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { searchIgdb, SearchServiceError } from '@/services/igdb';
import {
  respondToFriendRequest,
  searchUsers,
  sendFriendRequest,
  USER_SEARCH_MIN_LENGTH,
  type UserSearchResult,
} from '@/services/users';
import { IGDB_SEARCH_LIMITS, normalizeSearchQuery } from '@/types/igdb';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

const IGDB_STALE_MS = 5 * 60_000; // server caches 24h; avoid refetching on every tab switch
/** People change rarely and RAWG's free tier is metered: keep creator results for the whole session. */
const CREATOR_STALE_MS = 60 * 60_000;
const USERS_STALE_MS = 30_000;

function retryIfRetryable(failureCount: number, error: Error): boolean {
  if (error instanceof SearchServiceError && !error.retryable) return false;
  return failureCount < 2;
}

function isSearchable(term: string, min: number): boolean {
  return normalizeSearchQuery(term).length >= min;
}

/** Debounce the term before passing it in (see useDebouncedValue). */
export function useGameSearch(term: string) {
  return useQuery({
    queryKey: queryKeys.search.igdb('games', term),
    queryFn: ({ signal }) => searchIgdb('games', term, { signal }),
    enabled: isSearchable(term, IGDB_SEARCH_LIMITS.minQueryLength),
    staleTime: IGDB_STALE_MS,
    placeholderData: keepPreviousData,
    retry: retryIfRetryable,
  });
}

/** Studios, developers and publishers (IGDB /companies). */
export function useCompanySearch(term: string) {
  return useQuery({
    queryKey: queryKeys.search.igdb('companies', term),
    queryFn: ({ signal }) => searchIgdb('companies', term, { signal }),
    enabled: isSearchable(term, IGDB_SEARCH_LIMITS.minQueryLength),
    staleTime: IGDB_STALE_MS,
    placeholderData: keepPreviousData,
    retry: retryIfRetryable,
  });
}

/** Directors, writers, composers… (RAWG /creators via the proxy, cached server-side 14 days). */
export function useCreatorSearch(term: string) {
  return useQuery({
    queryKey: queryKeys.search.igdb('creators', term),
    queryFn: ({ signal }) => searchIgdb('creators', term, { signal }),
    enabled: isSearchable(term, IGDB_SEARCH_LIMITS.minQueryLength),
    staleTime: CREATOR_STALE_MS,
    gcTime: CREATOR_STALE_MS,
    placeholderData: keepPreviousData,
    retry: retryIfRetryable,
  });
}

export function useUserSearch(term: string) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: queryKeys.search.users(viewerId ?? 'anonymous', term),
    queryFn: ({ signal }) => searchUsers(term, viewerId!, signal),
    enabled: viewerId !== null && term.trim().length >= USER_SEARCH_MIN_LENGTH,
    staleTime: USERS_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

type FriendActionVariables =
  | { action: 'send'; friendId: string }
  | { action: 'accept'; friendshipId: string }
  | { action: 'decline'; friendshipId: string };

/**
 * Send / accept / decline friend requests from search results.
 * Optimistically updates every cached user-search page for snappy feedback.
 */
export function useFriendAction() {
  const queryClient = useQueryClient();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  return useMutation({
    mutationFn: async (vars: FriendActionVariables) => {
      if (!viewerId) throw new Error('You must be signed in.');
      if (vars.action === 'send') return sendFriendRequest(viewerId, vars.friendId);
      return respondToFriendRequest(vars.friendshipId, vars.action === 'accept');
    },
    onMutate: async (vars) => {
      const prefix = queryKeys.search.entity('users');
      await queryClient.cancelQueries({ queryKey: prefix });
      const snapshot = queryClient.getQueriesData<UserSearchResult[]>({ queryKey: prefix });

      queryClient.setQueriesData<UserSearchResult[]>({ queryKey: prefix }, (rows) =>
        rows?.map((row) => {
          if (vars.action === 'send' && row.id === vars.friendId) {
            return { ...row, relation: { state: 'outgoing', friendshipId: 'pending-optimistic' } };
          }
          if (vars.action !== 'send' && 'friendshipId' in row.relation && row.relation.friendshipId === vars.friendshipId) {
            return {
              ...row,
              relation: { state: vars.action === 'accept' ? 'friends' : 'declined', friendshipId: vars.friendshipId },
            };
          }
          return row;
        }),
      );
      return { snapshot };
    },
    onError: (_error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.entity('users') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all() });
    },
  });
}
