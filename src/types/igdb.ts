/**
 * IGDB proxy contract, re-exported from the Edge Function's shared module so
 * client and server can never drift apart.
 */
export {
  IGDB_LOOKUP_MAX_IDS,
  IGDB_SEARCH_LIMITS,
  igdbImageUrl,
  normalizeSearchQuery,
  SEARCH_PROVIDER,
  type CreatorResult,
  type GameReleaseDate,
  type IgdbDetailRequest,
  type IgdbDetailResponse,
  type IgdbGameDetail,
  type SystemRequirementLine,
  type SystemRequirements,
  type IgdbCompanyResult,
  type IgdbEntityType,
  type IgdbGameResult,
  type IgdbImageSize,
  type IgdbLookupRequest,
  type IgdbLookupResponse,
  type IgdbResultFor,
  type IgdbSearchRequest,
  type IgdbSearchResponse,
} from '../../supabase/functions/_shared/igdb-contract';
