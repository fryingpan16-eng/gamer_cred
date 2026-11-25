import type { PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

import type { FriendRatingRow } from '@/types/database.types';
import type { IgdbDetailResponse } from '@/types/igdb';

import { invokeProxy } from './igdb';
import { supabase } from './supabase';

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

/** `average` is on the canonical 1–100 scale; `distribution` has one count per score 1..100. */
/** Accepted friends' ratings of a game, quick or reviewed (migration 000016 RPC). */
export async function fetchFriendRatingsForGame(gameId: number): Promise<FriendRatingRow[]> {
  const { data, error } = await supabase.rpc('friend_ratings_for_game', { p_game_id: gameId });
  if (error) fail(error, "Could not load your friends' ratings.");
  return data;
}

const generationBadgeSchema = z.object({
  /** '1'–'9', 'pc', 'arcade' or 'mobile' (src/constants/generations.ts). */
  generation: z.string(),
  releaseYear: z.number().nullable(),
  /** Remakes: the group of the game it remakes. */
  remakeOf: z.string().nullable(),
  /** Later console generations its remasters came out on. */
  remasteredFor: z.array(z.string()),
  /** The seeded "Top 250" list for this group (null if the owner removed it). */
  listId: z.string().nullable(),
  /** Place on that list as of its last nightly refresh; null = not in it. */
  rank: z.number().nullable(),
});
export type GenerationBadgeData = z.infer<typeof generationBadgeSchema>;

/** The game page's generation badge (migration 000051); null when the game has no listed platform. */
export async function fetchGenerationBadge(gameId: number): Promise<GenerationBadgeData | null> {
  const { data, error } = await supabase.rpc('game_generation_badge', { p_game_id: gameId });
  if (error) fail(error, 'Could not load the generation.');
  if (data === null) return null;
  const parsed = generationBadgeSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

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
