import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  fetchDeveloperStats,
  fetchGenreStats,
  fetchLoggedOverTime,
  fetchPlatformStats,
  fetchRatingHistogram,
  fetchReleaseYearStats,
  fetchVsCommunity,
} from '@/services/stats';
import { queryKeys } from '@/utils/queryKeys';

import { useAuthStore } from './useAuth';

/** Stats change only when the user logs or edits a review (those mutations invalidate them). */
const STATS_STALE_MS = 5 * 60_000;

function useStatQuery<T>(stat: string, fetcher: () => Promise<T>, params: (string | number | null)[] = []) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: queryKeys.stats.stat(viewerId ?? 'anonymous', stat, ...params),
    queryFn: fetcher,
    enabled: viewerId !== null,
    staleTime: STATS_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export const useRatingHistogram = () => useStatQuery('ratingHistogram', fetchRatingHistogram);
export const usePlatformStats = () => useStatQuery('platforms', fetchPlatformStats);
/** `limit` null = the complete list of studios. */
export const useDeveloperStats = (limit: number | null) =>
  useStatQuery('developers', () => fetchDeveloperStats(limit), [limit]);
export const useGenreStats = () => useStatQuery('genres', fetchGenreStats);
export const useVsCommunity = (limit = 5) => useStatQuery('vsCommunity', () => fetchVsCommunity(limit), [limit]);
export const useReleaseYearStats = () => useStatQuery('releaseYears', fetchReleaseYearStats);
export const useLoggedOverTime = () => useStatQuery('loggedOverTime', fetchLoggedOverTime);
