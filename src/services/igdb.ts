import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';

import type { ApiEnvelope } from '@/types/api';
import {
  IGDB_LOOKUP_MAX_IDS,
  IGDB_SEARCH_LIMITS,
  normalizeSearchQuery,
  type IgdbCompanyDetailRequest,
  type IgdbCompanyDetailResponse,
  type IgdbDetailRequest,
  type IgdbLookupRequest,
  type IgdbLookupResponse,
  type IgdbSearchRequest,
  type IgdbSearchResponse,
} from '@/types/igdb';

import { supabase } from './supabase';

/** Entities searched through the proxy (games/companies → IGDB, creators → RAWG). */
export type IgdbSearchableEntity = 'games' | 'companies' | 'creators';

/** Error surfaced to the UI. `retryable` tells TanStack Query whether retrying can help. */
export class SearchServiceError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'SearchServiceError';
  }
}

async function readEnvelopeError(response: unknown): Promise<string | null> {
  if (!(response instanceof Response)) return null;
  try {
    const body = (await response.clone().json()) as Partial<ApiEnvelope<unknown>>;
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/**
 * Calls the `igdb-proxy` Edge Function. The client NEVER talks to IGDB/Twitch or
 * RAWG directly (CLAUDE.md); the proxy holds the credentials and the igdb_cache.
 */
/** Low-level proxy call with envelope unwrapping and retry-aware errors. */
export async function invokeProxy<T>(
  body: IgdbSearchRequest | IgdbLookupRequest | IgdbDetailRequest | IgdbCompanyDetailRequest,
  signal?: AbortSignal,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<ApiEnvelope<T>>('igdb-proxy', { body, signal });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const response = error.context as Response;
      const status = response.status;
      const message = (await readEnvelopeError(response)) ?? `Request failed (${status}).`;
      // 4xx (bad input / unsupported) won't improve on retry; 429/5xx might.
      throw new SearchServiceError(message, status, status === 429 || status >= 500);
    }
    if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
      throw new SearchServiceError('Cannot reach the game database. Check your connection.', null, true);
    }
    throw new SearchServiceError(error instanceof Error ? error.message : 'Request failed.', null, true);
  }

  if (!data || !data.success) {
    throw new SearchServiceError(data?.error ?? 'The game database returned an invalid response.', null, false);
  }
  return data.data;
}

/** Batch-resolves IGDB game ids to display records (title, cover…). Chunked to the proxy's max. */
export async function lookupGames(ids: readonly number[], signal?: AbortSignal): Promise<IgdbLookupResponse> {
  const unique = [...new Set(ids)];
  const chunks: number[][] = [];
  for (let i = 0; i < unique.length; i += IGDB_LOOKUP_MAX_IDS) chunks.push(unique.slice(i, i + IGDB_LOOKUP_MAX_IDS));

  const responses = await Promise.all(
    chunks.map((chunk) =>
      invokeProxy<IgdbLookupResponse>({ action: 'lookup', entity_type: 'games', ids: chunk }, signal),
    ),
  );
  return {
    entity_type: 'games',
    results: responses.flatMap((r) => r.results),
    missing: responses.flatMap((r) => r.missing),
    cachedCount: responses.reduce((n, r) => n + r.cachedCount, 0),
  };
}

export async function searchIgdb<E extends IgdbSearchableEntity>(
  entityType: E,
  rawQuery: string,
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<IgdbSearchResponse<E>> {
  const query = normalizeSearchQuery(rawQuery);
  if (query.length < IGDB_SEARCH_LIMITS.minQueryLength) {
    throw new SearchServiceError(`Type at least ${IGDB_SEARCH_LIMITS.minQueryLength} characters.`, 400, false);
  }

  return invokeProxy<IgdbSearchResponse<E>>(
    { action: 'search', entity_type: entityType, query, limit: options.limit },
    options.signal,
  );
}

/** Studio page: the company plus every catalogue game it developed or published. */
export function fetchCompanyDetail(companyId: number, signal?: AbortSignal): Promise<IgdbCompanyDetailResponse> {
  return invokeProxy<IgdbCompanyDetailResponse>({ action: 'company', entity_type: 'companies', id: companyId }, signal);
}
