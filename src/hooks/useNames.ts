import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  adminResetDisplayName,
  choosePermanentName,
  fetchProfileNames,
  updateDisplayName,
  type ProfileName,
} from '@/services/names';
import type { Profile } from '@/types/database.types';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';
import { useViewerId } from './useProfile';

const NAME_STALE_MS = 5 * 60 * 1000;
const MAX_PER_CALL = 200;

// Every name shown on a screen in the same tick shares one request.
type Waiter = { resolve: (byId: Map<string, ProfileName>) => void; reject: (error: unknown) => void };
let pending: { ids: Set<string>; waiters: Waiter[] } | null = null;

function flush() {
  const batch = pending;
  pending = null;
  if (!batch) return;
  const ids = [...batch.ids];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_PER_CALL) chunks.push(ids.slice(i, i + MAX_PER_CALL));
  Promise.all(chunks.map(fetchProfileNames)).then(
    (results) => {
      const byId = new Map(results.flat().map((n) => [n.id, n]));
      for (const w of batch.waiters) w.resolve(byId);
    },
    (error: unknown) => {
      for (const w of batch.waiters) w.reject(error);
    },
  );
}

function batchedName(id: string): Promise<Map<string, ProfileName>> {
  return new Promise((resolve, reject) => {
    if (!pending) {
      pending = { ids: new Set(), waiters: [] };
      setTimeout(flush, 0);
    }
    pending.ids.add(id);
    pending.waiters.push({ resolve, reject });
  });
}

/**
 * A player's display name and official badge. `null` data = hidden (blocked) or
 * gone; while loading, callers show the permanent name they already have.
 */
export function useProfileName(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.names.one(userId ?? 'none'),
    enabled: Boolean(userId),
    staleTime: NAME_STALE_MS,
    queryFn: async () => (await batchedName(userId!)).get(userId!) ?? null,
  });
}

/** After the viewer's own profile changes: the auth snapshot, their profile and their name everywhere. */
function syncOwnProfile(queryClient: QueryClient, profile: Profile) {
  queryClient.setQueryData(queryKeys.profiles.detail(profile.id), profile);
  useAuthStore.setState({ profile });
  queryClient.setQueryData<ProfileName | null>(queryKeys.names.one(profile.id), (old) => ({
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    isOfficial: old?.isOfficial ?? false,
  }));
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (displayName: string | null) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return updateDisplayName(viewerId, displayName);
    },
    onSuccess: (profile) => syncOwnProfile(queryClient, profile),
  });
}

/** One time only, for player_xxxxxx accounts (ChooseNameGate). */
export function useChoosePermanentName() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (name: string) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return choosePermanentName(viewerId, name);
    },
    onSuccess: (profile) => {
      syncOwnProfile(queryClient, profile);
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.entity('users') });
    },
  });
}

export function useAdminResetDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminResetDisplayName(userId),
    onSuccess: (_d, userId) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.names.one(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(userId) });
    },
  });
}
