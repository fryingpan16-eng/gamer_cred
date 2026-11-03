/**
 * Quick ratings (migration 000015, table public.game_ratings).
 *
 * A quick rating is a private overall score — it is NOT a review and these
 * functions never read or write public.reviews. Reviews are created only by
 * saveReview() in ./reviews.ts (the Review Studio). The database keeps the two
 * scores identical when a user has both (see the migration header).
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { GameRating } from '@/types/database.types';
import { reviewRating } from '@/utils/ratingColumns';
import type { StoredRating } from '@/utils/rating';

import { supabase } from './supabase';

/** SQLSTATE raised when clearing a rating that a published review needs (000015). */
export const RATING_NEEDED_BY_REVIEW = 'GR001';

export class RatingError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'RatingError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  if (error.code === RATING_NEEDED_BY_REVIEW) {
    throw new RatingError([error.message, error.hint].filter(Boolean).join(' '), error.code);
  }
  throw new RatingError(error.message || fallback, error.code ?? null);
}

/** gameId → the viewer's rating. Games without one are absent. */
export type MyRatings = Record<number, StoredRating>;

/**
 * The viewer's ratings for a batch of games in ONE request (search results,
 * a game page). Served by the (user_id, game_id) primary key.
 */
export async function fetchMyRatings(userId: string, gameIds: readonly number[]): Promise<MyRatings> {
  const ids = [...new Set(gameIds)].sort((a, b) => a - b);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('game_ratings')
    .select('game_id, rating, rating_input_scale, rating_input')
    .eq('user_id', userId)
    .in('game_id', ids);
  if (error) fail(error, 'Could not load your ratings.');
  const out: MyRatings = {};
  for (const row of data) {
    const rating = reviewRating(row);
    if (rating) out[row.game_id] = rating;
  }
  return out;
}

/** Set or change the viewer's quick rating (one per game: upsert on the primary key). */
export async function rateGame(userId: string, gameId: number, rating: StoredRating): Promise<GameRating> {
  const { data, error } = await supabase
    .from('game_ratings')
    .upsert(
      { user_id: userId, game_id: gameId, rating: rating.numeric, rating_input_scale: rating.inputScale, rating_input: rating.input },
      { onConflict: 'user_id,game_id' },
    )
    .select()
    .single();
  if (error) fail(error, 'Could not save your rating.');
  return data;
}

/** Remove the viewer's quick rating. Refused while a published review needs the score. */
export async function clearGameRating(userId: string, gameId: number): Promise<void> {
  const { error } = await supabase.from('game_ratings').delete().eq('user_id', userId).eq('game_id', gameId);
  if (error) fail(error, 'Could not clear your rating.');
}
