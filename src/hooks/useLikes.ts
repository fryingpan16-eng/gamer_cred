import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchGameLikes, fetchLikedGames, setGameLike, type GameLikeInfo } from '@/services/likes';
import { queryKeys } from '@/utils/queryKeys';

import { useMemberId } from './useAuth';
import { showToast } from './useToastStore';

/** A game's like count and whether you like it. */
export function useGameLikes(gameId: number | null) {
  const viewerId = useMemberId();
  return useQuery({
    queryKey: queryKeys.likes.game(gameId ?? 0, viewerId ?? 'guest'),
    queryFn: () => fetchGameLikes(gameId!, viewerId),
    enabled: gameId !== null,
    staleTime: 60_000,
  });
}

/** Toggle your like — instant (optimistic), rolled back with a message if it fails. */
export function useToggleLike(gameId: number) {
  const queryClient = useQueryClient();
  const viewerId = useMemberId();
  const key = queryKeys.likes.game(gameId, viewerId ?? 'guest');
  return useMutation({
    mutationFn: (liked: boolean) => {
      if (!viewerId) throw new Error('Create a free account to like games.');
      return setGameLike(viewerId, gameId, liked);
    },
    onMutate: async (liked) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<GameLikeInfo>(key);
      if (previous && previous.liked !== liked) {
        queryClient.setQueryData<GameLikeInfo>(key, { liked, count: Math.max(0, previous.count + (liked ? 1 : -1)) });
      }
      return { previous };
    },
    onError: (error, _liked, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      showToast(error.message, 'error');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      if (viewerId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.likes.byUser(viewerId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.stats.byUser(viewerId) });
      }
    },
  });
}

/** A player's liked games (newest first). */
export function useLikedGames(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.likes.byUser(userId ?? 'none'),
    queryFn: () => fetchLikedGames(userId!),
    enabled: userId !== null,
    staleTime: 60_000,
  });
}
