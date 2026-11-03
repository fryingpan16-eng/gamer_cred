import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchFriendsList } from '@/services/friends';
import { removeFriendship, respondToFriendRequest } from '@/services/users';
import { queryKeys } from '@/utils/queryKeys';

import { useViewerId } from './useProfile';
import { showToast } from './useToastStore';

/** A player's friends (and your pending requests, on your own page). */
export function useFriendsList(userId: string | null) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.friendships.list(userId ?? 'none'),
    queryFn: () => fetchFriendsList(userId!, viewerId!),
    enabled: Boolean(userId && viewerId),
  });
}

export type FriendsPageAction =
  | { action: 'accept'; friendshipId: string }
  | { action: 'decline'; friendshipId: string }
  /** Cancel your request, or unfriend. */
  | { action: 'remove'; friendshipId: string };

/** Accept / decline / cancel / unfriend from the friends page. Refreshes every friendship view. */
export function useFriendsPageAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: FriendsPageAction) =>
      vars.action === 'remove' ? removeFriendship(vars.friendshipId) : respondToFriendRequest(vars.friendshipId, vars.action === 'accept'),
    onError: (error) => showToast(error instanceof Error ? error.message : 'Could not update that friendship.', 'error'),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendships.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.entity('users') });
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() });
    },
  });
}
