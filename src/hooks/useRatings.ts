import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { create } from 'zustand';

import { clearGameRating, fetchMyRatings, rateGame, type MyRatings } from '@/services/ratings';
import type { StoredRating } from '@/utils/rating';
import { RatingQueue } from '@/utils/ratingQueue';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';
import { showToast } from './useToastStore';

/**
 * Quick ratings: a private overall score per game. These hooks never create
 * or open a review — reviews are only started from the Review Studio or the
 * game page's "Write a review" button (see src/components/rating/README.md).
 */

const SAVE_DEBOUNCE_MS = 400;

function useViewerId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

const currentViewerId = (): string | null => useAuthStore.getState().user?.id ?? null;

/** The viewer's ratings for a set of games — one request for the whole batch (search results). */
export function useMyGameRatings(gameIds: readonly number[]) {
  const viewerId = useViewerId();
  const ids = [...new Set(gameIds)].sort((a, b) => a - b);
  return useQuery({
    queryKey: queryKeys.ratings.mine(viewerId ?? 'anonymous', ids),
    queryFn: () => fetchMyRatings(viewerId!, ids),
    enabled: viewerId !== null && ids.length > 0,
    staleTime: 60_000,
    // Keep the previous batch's stars visible while a new result page loads.
    placeholderData: (previous) => previous,
  });
}

/** One game's rating (game page). */
export function useMyGameRating(gameId: number | null) {
  const query = useMyGameRatings(gameId === null ? [] : [gameId]);
  return { ...query, rating: gameId === null ? null : (query.data?.[gameId] ?? null) };
}

/** Write a value into every cached batch (optimistic update / rollback). */
function patchCachedRating(queryClient: QueryClient, userId: string, gameId: number, value: StoredRating | null) {
  queryClient.setQueriesData<MyRatings>({ queryKey: queryKeys.ratings.byUser(userId) }, (old) => {
    if (!old) return old;
    const next = { ...old };
    if (value) next[gameId] = value;
    else delete next[gameId];
    return next;
  });
}

/** A rating changes the user's score everywhere it shows (stats, Gamer Cred average, their review's score). */
function invalidateAfterRating(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.stats.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewStatsAll() });
  // The sync trigger also updates the score on the user's review of this game, if any.
  void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.all() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.games.reviewsAll() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.games.friendReviewsAll() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all() });
}

const sameRating = (a: StoredRating | null, b: StoredRating | null) =>
  a === b || (a !== null && b !== null && a.numeric === b.numeric && a.inputScale === b.inputScale && a.input === b.input);

// ---------------------------------------------------------------------------
// Signed-out handoff: a tap without a session remembers the rating, sends the
// user to sign in, and applies it afterwards (useApplyPendingRating).
// ---------------------------------------------------------------------------

type PendingRating = { gameId: number; value: StoredRating | null };

export const usePendingRatingStore = create<{
  pending: PendingRating | null;
  setPending: (pending: PendingRating | null) => void;
}>()((set) => ({ pending: null, setPending: (pending) => set({ pending }) }));

/** Mounted in the signed-in shell: applies a rating tapped while signed out. */
export function useApplyPendingRating() {
  const viewerId = useViewerId();
  const pending = usePendingRatingStore((s) => s.pending);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!viewerId || !pending) return;
    usePendingRatingStore.getState().setPending(null);
    const { gameId, value } = pending;
    const save = value ? rateGame(viewerId, gameId, value).then(() => undefined) : clearGameRating(viewerId, gameId);
    save
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.ratings.all() });
        invalidateAfterRating(queryClient);
      })
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : 'Could not save your rating.', 'error'));
  }, [viewerId, pending, queryClient]);
}

/**
 * Set / change / clear a quick rating with optimistic feedback.
 * Rapid changes are debounced and saved one at a time per game (latest wins);
 * a failed save rolls the stars back and shows an error toast.
 */
export function useRateGame() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  // One queue per mounted control; its callbacks read the current viewer from the auth store at save time.
  const [queue] = useState(
    () =>
      new RatingQueue<StoredRating>({
        delayMs: SAVE_DEBOUNCE_MS,
        equals: sameRating,
        save: async (gameId, value) => {
          const userId = currentViewerId();
          if (!userId) throw new Error('You must be signed in.');
          if (value) await rateGame(userId, gameId, value);
          else await clearGameRating(userId, gameId);
        },
        onSaved: () => invalidateAfterRating(queryClient),
        onFailed: (gameId, confirmed, error) => {
          const userId = currentViewerId();
          if (userId) patchCachedRating(queryClient, userId, gameId, confirmed);
          showToast(error instanceof Error ? error.message : 'Could not save your rating.', 'error');
        },
      }),
  );

  // Leaving the screen mid-debounce still saves the last tap.
  useEffect(() => () => void queue.flushAll(), [queue]);

  /** `current` = the rating currently shown for the game (before this change). */
  const rate = useCallback(
    (gameId: number, value: StoredRating | null, current: StoredRating | null) => {
      if (!viewerId) {
        usePendingRatingStore.getState().setPending({ gameId, value });
        router.push('/login');
        return;
      }
      // A background refetch landing mid-change would overwrite the optimistic stars.
      void queryClient.cancelQueries({ queryKey: queryKeys.ratings.byUser(viewerId) });
      patchCachedRating(queryClient, viewerId, gameId, value);
      queue.set(gameId, value, current);
    },
    [queryClient, viewerId, queue],
  );

  return { rate };
}
