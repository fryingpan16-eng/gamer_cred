/**
 * Quick ratings (migrations 000015–000016, table public.game_ratings).
 *
 * A quick rating is an overall score + the platform it was played on. Ratings
 * are public to read (profiles, friends' ratings) but they are NOT reviews: these
 * functions never read or write public.reviews. Reviews are created only by
 * saveReview() in ./reviews.ts (the Review Studio). The database keeps the two
 * scores identical when a user has both (see the migration header).
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { GameRating } from '@/types/database.types';
import { reviewRating } from '@/utils/ratingColumns';
import type { RatingsTableSource } from '@/utils/ratingsTable';
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

/** A rating plus the platform it was played on (catalog id = IGDB platform id). */
export type GameRatingEntry = StoredRating & { platformId: number | null };

/** gameId → the viewer's rating. Games without one are absent. */
export type MyRatings = Record<number, GameRatingEntry>;

function entryFromRow(row: { rating: number; rating_input_scale: GameRating['rating_input_scale']; rating_input: string; platform_id: number | null }): GameRatingEntry | null {
  const rating = reviewRating(row);
  return rating ? { ...rating, platformId: row.platform_id } : null;
}

/**
 * The viewer's ratings for a batch of games in ONE request (search results,
 * a game page). Served by the (user_id, game_id) primary key.
 */
export async function fetchMyRatings(userId: string, gameIds: readonly number[]): Promise<MyRatings> {
  const ids = [...new Set(gameIds)].sort((a, b) => a - b);
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from('game_ratings')
    .select('game_id, rating, rating_input_scale, rating_input, platform_id')
    .eq('user_id', userId)
    .in('game_id', ids);
  if (error) fail(error, 'Could not load your ratings.');
  const out: MyRatings = {};
  for (const row of data) {
    const entry = entryFromRow(row);
    if (entry) out[row.game_id] = entry;
  }
  return out;
}

export type UserRating = GameRatingEntry & { gameId: number; ratedAt: string; /** Replays of the game (migration 000040). */ replays: number };
export type UserRatingsPage = { ratings: UserRating[]; total: number };

/** A player's ratings, newest first (public; shown on profiles). */
export async function fetchUserRatings(userId: string, limit = 24): Promise<UserRatingsPage> {
  const { data, error, count } = await supabase
    .from('game_ratings')
    .select('game_id, rating, rating_input_scale, rating_input, platform_id, updated_at', { count: 'exact' })
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) fail(error, 'Could not load ratings.');
  const replays = new Map<number, number>();
  if (data.length > 0) {
    const counts = await supabase.rpc('replay_counts', { p_user_id: userId, p_game_ids: data.map((r) => r.game_id) });
    if (counts.error) fail(counts.error, 'Could not load ratings.');
    for (const c of counts.data) replays.set(Number(c.game_id), c.replays);
  }
  const ratings: UserRating[] = [];
  for (const row of data) {
    const entry = entryFromRow(row);
    if (entry) ratings.push({ ...entry, gameId: row.game_id, ratedAt: row.updated_at, replays: replays.get(Number(row.game_id)) ?? 0 });
  }
  return { ratings, total: count ?? ratings.length };
}

/** Every rating of a player with game metadata, for the ratings spreadsheet (one RPC). */
export async function fetchRatingsTable(userId: string): Promise<RatingsTableSource[]> {
  const { data, error } = await supabase.rpc('user_ratings_table', { p_user_id: userId });
  if (error) fail(error, 'Could not load ratings.');
  const out: RatingsTableSource[] = [];
  for (const row of data) {
    const rating = reviewRating(row);
    if (rating) out.push({ ...row, rating });
  }
  return out;
}

/** Set or change the viewer's quick rating + platform (one per game: upsert on the primary key). */
export async function rateGame(userId: string, gameId: number, rating: GameRatingEntry): Promise<GameRating> {
  const { data, error } = await supabase
    .from('game_ratings')
    .upsert(
      {
        user_id: userId,
        game_id: gameId,
        rating: rating.numeric,
        rating_input_scale: rating.inputScale,
        rating_input: rating.input,
        platform_id: rating.platformId,
      },
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
