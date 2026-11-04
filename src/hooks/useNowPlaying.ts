import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  assignGameToSlot,
  clearSlot,
  fetchNowPlaying,
  updateSlotDetails,
  type SlotDetails,
} from '@/services/nowPlaying';
import type { NowPlaying, NowPlayingSlot } from '@/types/database.types';
import { slotRatingColumns } from '@/utils/ratingColumns';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

function useViewerId(): string | null {
  // Members only: guests have no data of their own.
  return useAuthStore((s) => (s.isGuest ? null : (s.user?.id ?? null)));
}

/** Now Playing rows for a user (defaults to the signed-in user). */
export function useNowPlaying(userId?: string) {
  const viewerId = useViewerId();
  const targetId = userId ?? viewerId;
  return useQuery({
    queryKey: queryKeys.nowPlaying.byUser(targetId ?? 'anonymous'),
    queryFn: () => fetchNowPlaying(targetId!),
    enabled: targetId !== null,
  });
}

export type UpdateSlotVariables =
  /** Assign or swap the slot's game (resets notes & score). */
  | { slot: NowPlayingSlot; gameId: number }
  /** Edit running notes / preliminary score of an occupied slot. */
  | { slot: NowPlayingSlot; details: SlotDetails };

function sortSlots(rows: NowPlaying[]): NowPlaying[] {
  return [...rows].sort((a, b) => a.slot_index - b.slot_index);
}

/** Assign/swap a game or edit notes/score, applied optimistically with rollback on error. */
export function useUpdateNowPlayingSlot() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();

  return useMutation({
    mutationFn: (vars: UpdateSlotVariables) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return 'gameId' in vars
        ? assignGameToSlot(viewerId, vars.slot, vars.gameId)
        : updateSlotDetails(viewerId, vars.slot, vars.details);
    },
    onMutate: async (vars) => {
      if (!viewerId) return { previous: undefined };
      const key = queryKeys.nowPlaying.byUser(viewerId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NowPlaying[]>(key);

      queryClient.setQueryData<NowPlaying[]>(key, (rows = []) => {
        const now = new Date().toISOString();
        const others = rows.filter((r) => r.slot_index !== vars.slot);
        const current = rows.find((r) => r.slot_index === vars.slot);
        if ('gameId' in vars) {
          return sortSlots([
            ...others,
            {
              user_id: viewerId,
              slot_index: vars.slot,
              game_id: vars.gameId,
              notes: null,
              ...slotRatingColumns(null),
              legacy_preliminary_score_10: null,
              updated_at: now,
            },
          ]);
        }
        if (!current) return rows;
        const { notes, preliminary } = vars.details;
        return sortSlots([
          ...others,
          {
            ...current,
            ...(notes !== undefined ? { notes } : {}),
            ...(preliminary !== undefined ? slotRatingColumns(preliminary) : {}),
            updated_at: now,
          },
        ]);
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (viewerId && context) queryClient.setQueryData(queryKeys.nowPlaying.byUser(viewerId), context.previous);
    },
    onSettled: () => {
      if (viewerId) void queryClient.invalidateQueries({ queryKey: queryKeys.nowPlaying.byUser(viewerId) });
    },
  });
}

export function useRemoveNowPlayingSlot() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();

  return useMutation({
    mutationFn: (slot: NowPlayingSlot) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return clearSlot(viewerId, slot);
    },
    onMutate: async (slot) => {
      if (!viewerId) return { previous: undefined };
      const key = queryKeys.nowPlaying.byUser(viewerId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NowPlaying[]>(key);
      queryClient.setQueryData<NowPlaying[]>(key, (rows = []) => rows.filter((r) => r.slot_index !== slot));
      return { previous };
    },
    onError: (_error, _slot, context) => {
      if (viewerId && context) queryClient.setQueryData(queryKeys.nowPlaying.byUser(viewerId), context.previous);
    },
    onSettled: () => {
      if (viewerId) void queryClient.invalidateQueries({ queryKey: queryKeys.nowPlaying.byUser(viewerId) });
    },
  });
}
