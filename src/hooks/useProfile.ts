import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';

import {
  addPlatform,
  fetchFavorites,
  fetchFriendCount,
  fetchPlatforms,
  fetchProfile,
  fetchPublishedReviews,
  fetchRelation,
  removeFavorite,
  removePlatform,
  setFavorite,
  setMainPlatform,
  swapFavoriteRanks,
  updatePcSpecs,
  updatePrimaryRatingScale,
  updateProfile,
} from '@/services/profile';
import {
  removeFriendship,
  respondToFriendRequest,
  sendFriendRequest,
  type FriendRelation,
} from '@/services/users';
import type { FavoriteRank, Profile, UserFavorite, UserPlatform } from '@/types/database.types';
import type { RatingScale } from '@/constants/ratingRubric';
import type { ProfileSettingsValues } from '@/utils/profileSchemas';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

export function useViewerId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

/**
 * Shared optimistic-update plumbing: cancel in-flight fetches, snapshot, apply,
 * roll back on error, and always re-sync with the server afterwards.
 */
function optimistic<TData, TVars>(
  queryClient: ReturnType<typeof useQueryClient>,
  key: (vars: TVars) => QueryKey,
  apply: (data: TData | undefined, vars: TVars) => TData | undefined,
) {
  return {
    onMutate: async (vars: TVars) => {
      const k = key(vars);
      await queryClient.cancelQueries({ queryKey: k });
      const previous = queryClient.getQueryData<TData>(k);
      queryClient.setQueryData<TData>(k, (data) => apply(data, vars));
      return { previous, k };
    },
    onError: (_e: Error, _v: TVars, ctx: { previous: TData | undefined; k: QueryKey } | undefined) => {
      if (ctx) queryClient.setQueryData(ctx.k, ctx.previous);
    },
    onSettled: (_d: unknown, _e: Error | null, vars: TVars) => {
      void queryClient.invalidateQueries({ queryKey: key(vars) });
    },
  };
}

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

export function useProfile(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.profiles.detail(userId ?? 'none'),
    queryFn: () => fetchProfile(userId!),
    enabled: Boolean(userId),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: async ({ current, values }: { current: Profile; values: ProfileSettingsValues }) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return updateProfile(viewerId, current, values);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profiles.detail(profile.id), profile);
      // Keep the auth snapshot (header, account panel) in sync without a refetch.
      useAuthStore.setState({ profile });
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.search.entity('users') }),
  });
}

/** Switch the viewer's primary rating scale — optimistic on the auth snapshot. */
export function useUpdatePrimaryRatingScale() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (scale: RatingScale) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return updatePrimaryRatingScale(viewerId, scale);
    },
    onMutate: (scale) => {
      const previous = useAuthStore.getState().profile;
      if (previous) useAuthStore.setState({ profile: { ...previous, primary_rating_scale: scale } });
      return { previous };
    },
    onError: (_e, _scale, ctx) => {
      if (ctx?.previous) useAuthStore.setState({ profile: ctx.previous });
    },
    onSuccess: (profile) => {
      useAuthStore.setState({ profile });
      queryClient.setQueryData(queryKeys.profiles.detail(profile.id), profile);
    },
  });
}

// -----------------------------------------------------------------------------
// Top 4 favorites
// -----------------------------------------------------------------------------

export function useFavorites(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.profiles.favorites(userId ?? 'none'),
    queryFn: () => fetchFavorites(userId!),
    enabled: Boolean(userId),
  });
}

export type FavoriteAction =
  | { action: 'set'; rank: FavoriteRank; gameId: number }
  | { action: 'swap'; a: FavoriteRank; b: FavoriteRank }
  | { action: 'remove'; rank: FavoriteRank };

function applyFavoriteAction(rows: UserFavorite[] = [], vars: FavoriteAction, userId: string): UserFavorite[] {
  let next = [...rows];
  if (vars.action === 'set') {
    next = next.filter((r) => r.rank !== vars.rank && r.game_id !== vars.gameId);
    next.push({ user_id: userId, game_id: vars.gameId, rank: vars.rank });
  } else if (vars.action === 'swap') {
    next = next.map((r) =>
      r.rank === vars.a ? { ...r, rank: vars.b } : r.rank === vars.b ? { ...r, rank: vars.a } : r,
    );
  } else {
    next = next.filter((r) => r.rank !== vars.rank);
  }
  return next.sort((x, y) => x.rank - y.rank);
}

/** Set / move / swap / remove a Top 4 favorite — optimistic. */
export function useFavoriteMutation() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (vars: FavoriteAction) => {
      if (!viewerId) throw new Error('You must be signed in.');
      if (vars.action === 'set') return setFavorite(vars.rank, vars.gameId);
      if (vars.action === 'swap') return swapFavoriteRanks(vars.a, vars.b);
      return removeFavorite(viewerId, vars.rank);
    },
    ...optimistic<UserFavorite[], FavoriteAction>(
      queryClient,
      () => queryKeys.profiles.favorites(viewerId ?? 'none'),
      (rows, vars) => (viewerId ? applyFavoriteAction(rows, vars, viewerId) : rows),
    ),
  });
}

// -----------------------------------------------------------------------------
// Platform roster
// -----------------------------------------------------------------------------

export function usePlatforms(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.profiles.platforms(userId ?? 'none'),
    queryFn: () => fetchPlatforms(userId!),
    enabled: Boolean(userId),
  });
}

export type PlatformAction =
  | { action: 'add'; platformId: number }
  | { action: 'remove'; platformId: number }
  | { action: 'setMain'; platformId: number | null }
  | { action: 'specs'; platformId: number; pcSpecs: string | null };

function applyPlatformAction(rows: UserPlatform[] = [], vars: PlatformAction, userId: string): UserPlatform[] {
  switch (vars.action) {
    case 'add':
      return rows.some((r) => r.platform_id === vars.platformId)
        ? rows
        : [...rows, { user_id: userId, platform_id: vars.platformId, is_main: false, pc_specs: null }];
    case 'remove':
      return rows.filter((r) => r.platform_id !== vars.platformId);
    case 'setMain':
      return rows.map((r) => ({ ...r, is_main: r.platform_id === vars.platformId }));
    case 'specs':
      return rows.map((r) => (r.platform_id === vars.platformId ? { ...r, pc_specs: vars.pcSpecs } : r));
  }
}

/** Toggle owned platforms, move the Main badge, edit PC specs — optimistic. */
export function usePlatformMutation() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (vars: PlatformAction) => {
      if (!viewerId) throw new Error('You must be signed in.');
      switch (vars.action) {
        case 'add':
          return addPlatform(viewerId, vars.platformId);
        case 'remove':
          return removePlatform(viewerId, vars.platformId);
        case 'setMain':
          return setMainPlatform(vars.platformId);
        case 'specs':
          return updatePcSpecs(viewerId, vars.platformId, vars.pcSpecs);
      }
    },
    ...optimistic<UserPlatform[], PlatformAction>(
      queryClient,
      () => queryKeys.profiles.platforms(viewerId ?? 'none'),
      (rows, vars) => (viewerId ? applyPlatformAction(rows, vars, viewerId) : rows),
    ),
  });
}

// -----------------------------------------------------------------------------
// Friendships
// -----------------------------------------------------------------------------

export function useFriendRelation(otherId: string | null | undefined) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.friendships.relation(viewerId ?? 'none', otherId ?? 'none'),
    queryFn: () => fetchRelation(viewerId!, otherId!),
    enabled: Boolean(viewerId && otherId && viewerId !== otherId),
  });
}

export function useFriendCount(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.friendships.count(userId ?? 'none'),
    queryFn: () => fetchFriendCount(userId!),
    enabled: Boolean(userId),
  });
}

export type FriendRequestAction =
  | { action: 'send' }
  | { action: 'accept'; friendshipId: string }
  | { action: 'decline'; friendshipId: string }
  /** Cancel my pending request, or unfriend. */
  | { action: 'remove'; friendshipId: string };

/** Friend button state machine for one other player — optimistic. */
export function useFriendRequestMutation(otherId: string) {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  const relationKey = () => queryKeys.friendships.relation(viewerId ?? 'none', otherId);

  return useMutation({
    mutationFn: (vars: FriendRequestAction) => {
      if (!viewerId) throw new Error('You must be signed in.');
      switch (vars.action) {
        case 'send':
          return sendFriendRequest(viewerId, otherId);
        case 'accept':
          return respondToFriendRequest(vars.friendshipId, true);
        case 'decline':
          return respondToFriendRequest(vars.friendshipId, false);
        case 'remove':
          return removeFriendship(vars.friendshipId);
      }
    },
    ...optimistic<FriendRelation, FriendRequestAction>(queryClient, relationKey, (_current, vars): FriendRelation => {
      switch (vars.action) {
        case 'send':
          return { state: 'outgoing', friendshipId: 'pending-optimistic' };
        case 'accept':
          return { state: 'friends', friendshipId: vars.friendshipId };
        case 'decline':
          return { state: 'declined', friendshipId: vars.friendshipId, direction: 'incoming' };
        case 'remove':
          return { state: 'none' };
      }
    }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: relationKey() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.friendships.count(otherId) });
      if (viewerId) void queryClient.invalidateQueries({ queryKey: queryKeys.friendships.count(viewerId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.search.entity('users') });
    },
  });
}

// -----------------------------------------------------------------------------
// Published reviews
// -----------------------------------------------------------------------------

export function usePublishedReviews(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.reviews.byUser(userId ?? 'none'),
    queryFn: () => fetchPublishedReviews(userId!),
    enabled: Boolean(userId),
  });
}
