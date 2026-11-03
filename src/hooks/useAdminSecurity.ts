import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchAdminActivity, fetchAdminStatus, startAuthenticatorSetup, verifyAuthenticatorCode } from '@/services/adminSecurity';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

/** Admin membership + whether this sign-in passed the code check. */
export function useAdminStatus() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: queryKeys.safety.adminStatus(userId ?? 'none'),
    queryFn: fetchAdminStatus,
    enabled: userId !== null,
    staleTime: 60_000,
  });
}

export function useStartAuthenticatorSetup() {
  return useMutation({ mutationFn: startAuthenticatorSetup });
}

/** Verify a code; then every admin query (status, tools, queues) reloads with admin access. */
export function useVerifyAdminCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ factorId, code }: { factorId: string; code: string }) => verifyAuthenticatorCode(factorId, code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.safety.all() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all() });
    },
  });
}

export function useAdminActivity(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.safety.adminActivity(), queryFn: () => fetchAdminActivity(), enabled, staleTime: 30_000 });
}
