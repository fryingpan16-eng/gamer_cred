import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { TERMS_VERSION } from '@/constants/legal';
import { signOut } from '@/services/auth';
import {
  acceptTerms,
  adminDeleteUser,
  blockUser,
  deleteMyAccount,
  fetchAdminReports,
  fetchBlockedUsers,
  fetchBlockState,
  hasAcceptedTerms,
  resolveReports,
  submitReport,
  unblockUser,
  type ReportInput,
} from '@/services/safety';
import type { ReportTarget } from '@/types/database.types';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';
import { showToast } from './useToastStore';

function useViewerId(): string | null {
  return useAuthStore((s) => s.user?.id ?? null);
}

export function useBlockedUsers() {
  const viewerId = useViewerId();
  return useQuery({ queryKey: queryKeys.safety.blocked(viewerId ?? 'none'), queryFn: fetchBlockedUsers, enabled: viewerId !== null });
}

export function useBlockState(userId: string | null) {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.safety.blockState(viewerId ?? 'none', userId ?? 'none'),
    queryFn: () => fetchBlockState(userId!),
    enabled: viewerId !== null && userId !== null && userId !== viewerId,
  });
}

/**
 * Block / unblock. Blocking hides content everywhere (feeds, search, lists,
 * ratings, friends), so every cached query is refreshed afterwards.
 */
export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, block }: { userId: string; block: boolean }) => (block ? blockUser(userId) : unblockUser(userId)),
    onSuccess: (_d, v) => showToast(v.block ? 'Player blocked. You won’t see each other on GamerCred.' : 'Player unblocked.', 'success'),
    onError: (e) => showToast(e.message, 'error'),
    onSettled: () => void queryClient.invalidateQueries(),
  });
}

export function useSubmitReport() {
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: (input: ReportInput) => {
      if (!viewerId) throw new Error('You must be signed in.');
      return submitReport(viewerId, input);
    },
  });
}

export function useAdminReports(status: 'open' | 'actioned' | 'dismissed') {
  return useQuery({ queryKey: queryKeys.safety.reports(status), queryFn: () => fetchAdminReports(status) });
}

export type ModerationAction = { type: ReportTarget; id: string; userId: string; action: 'dismiss' | 'remove' | 'removeUser'; note?: string };

/** Admin: dismiss, remove the content, or remove the whole account. */
export function useModerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (a: ModerationAction) => {
      if (a.action === 'removeUser') {
        await adminDeleteUser(a.userId);
        return;
      }
      await resolveReports({ type: a.type, id: a.id, userId: a.userId }, a.action === 'remove', a.note);
    },
    onSuccess: (_d, a) =>
      showToast(a.action === 'dismiss' ? 'Report dismissed.' : a.action === 'remove' ? 'Content removed.' : 'Account removed.', 'success'),
    onError: (e) => showToast(e.message, 'error'),
    onSettled: () => void queryClient.invalidateQueries(),
  });
}

/** Whether the viewer accepted the current Terms of Use / Community Guidelines. */
export function useTermsAccepted() {
  const viewerId = useViewerId();
  return useQuery({
    queryKey: queryKeys.safety.terms(viewerId ?? 'none', TERMS_VERSION),
    queryFn: () => hasAcceptedTerms(viewerId!, TERMS_VERSION),
    enabled: viewerId !== null,
    staleTime: Infinity,
  });
}

export function useAcceptTerms() {
  const queryClient = useQueryClient();
  const viewerId = useViewerId();
  return useMutation({
    mutationFn: () => {
      if (!viewerId) throw new Error('You must be signed in.');
      return acceptTerms(viewerId, TERMS_VERSION);
    },
    onSuccess: () => {
      if (viewerId) queryClient.setQueryData(queryKeys.safety.terms(viewerId, TERMS_VERSION), true);
    },
  });
}

/** Deletes the account server-side, then signs out locally and clears every cache. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await deleteMyAccount();
      await signOut(); // the session belongs to a deleted user; drop it on this device
      queryClient.clear();
    },
  });
}
