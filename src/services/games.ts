import type { PostgrestError } from '@supabase/supabase-js';

import type { IgdbDetailResponse } from '@/types/igdb';

import { invokeProxy } from './igdb';
import { supabase } from './supabase';

export const GAME_REVIEWS_PAGE_SIZE = 20;

export class GameDataError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'GameDataError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  throw new GameDataError(error.message || fallback, error.code ?? null);
}

/**
 * Full game page record through the Edge Function (never IGDB/RAWG directly).
 * The proxy caches the merged IGDB + RAWG record for 7 days.
 */
export function fetchGameDetail(gameId: number, signal?: AbortSignal): Promise<IgdbDetailResponse> {
  return invokeProxy<IgdbDetailResponse>({ action: 'detail', entity_type: 'games', id: gameId }, signal);
}

const REVIEW_WITH_AUTHOR = `
  id, user_id, game_id, rating, rating_input_scale, rating_input, content, published_at, updated_at,
  author:profiles!reviews_user_id_fkey ( id, username, avatar_url )
` as const;

async function queryGameReviews(gameId: number, page: number) {
  const from = page * GAME_REVIEWS_PAGE_SIZE;
  return supabase
    .from('reviews')
    .select(REVIEW_WITH_AUTHOR)
    .eq('game_id', gameId)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(from, from + GAME_REVIEWS_PAGE_SIZE - 1);
}

export type GameReview = NonNullable<Awaited<ReturnType<typeof queryGameReviews>>['data']>[number];

export type GameReviewsPage = { reviews: GameReview[]; nextPage: number | null };

/** Published community reviews for a game, newest first, with author profiles. */
export async function fetchGameReviews(gameId: number, page: number): Promise<GameReviewsPage> {
  const { data, error } = await queryGameReviews(gameId, page);
  if (error) fail(error, 'Could not load community reviews.');
  return { reviews: data, nextPage: data.length === GAME_REVIEWS_PAGE_SIZE ? page + 1 : null };
}

/** `average` is on the canonical 1–100 scale; `distribution` has one count per score 1..100. */
export type GameReviewStats = { count: number; average: number | null; distribution: number[] };

/** Aggregate community score (migration 000006 RPC). */
export async function fetchGameReviewStats(gameId: number): Promise<GameReviewStats> {
  const { data, error } = await supabase.rpc('game_review_stats', { p_game_id: gameId });
  if (error) fail(error, 'Could not load the community score.');
  const row = data[0];
  return {
    count: row?.review_count ?? 0,
    average: row?.average_rating === null || row?.average_rating === undefined ? null : Number(row.average_rating),
    distribution: row?.distribution ?? Array.from({ length: 100 }, () => 0),
  };
}
