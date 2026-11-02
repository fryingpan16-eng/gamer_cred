/**
 * IGDB proxy contract, re-exported from the Edge Function's shared module so
 * client and server can never drift apart.
 */
export {
  IGDB_SEARCH_LIMITS,
  igdbImageUrl,
  normalizeSearchQuery,
  SEARCH_PROVIDER,
  type CreatorResult,
  type IgdbCompanyResult,
  type IgdbEntityType,
  type IgdbGameResult,
  type IgdbImageSize,
  type IgdbResultFor,
  type IgdbSearchRequest,
  type IgdbSearchResponse,
} from '../../supabase/functions/_shared/igdb-contract';
