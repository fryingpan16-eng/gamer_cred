import { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/utils/queryKeys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Per-game records primed by lookups/searches have no observer of their own, so
// the default 5-minute gcTime would drop them long before they go stale (6 h).
queryClient.setQueryDefaults(queryKeys.games.detailAll(), { gcTime: 6 * 60 * 60_000 });
