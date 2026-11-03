import { useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchCompanyDetail, SearchServiceError } from '@/services/igdb';
import { queryKeys } from '@/utils/queryKeys';

import { primeGameCache } from './useGames';

/** The proxy caches studio pages for 7 days; one fetch per session is plenty. */
const COMPANY_STALE_MS = 30 * 60_000;

/** A studio page: company info + its games (each also primed as a light game record). */
export function useCompanyDetail(companyId: number | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.companies.detail(companyId ?? 0),
    enabled: companyId !== null,
    staleTime: COMPANY_STALE_MS,
    queryFn: async ({ signal }) => {
      const response = await fetchCompanyDetail(companyId!, signal);
      primeGameCache(queryClient, response.company.games);
      return response;
    },
    retry: (count, error) => !(error instanceof SearchServiceError && !error.retryable) && count < 2,
  });
}
