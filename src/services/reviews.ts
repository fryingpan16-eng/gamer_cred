import type { PostgrestError } from '@supabase/supabase-js';

import type { Review, ReviewStatus } from '@/types/database.types';
import { reviewRatingColumns } from '@/utils/ratingColumns';
import type { ReviewFormValues } from '@/utils/reviewSchemas';

import { supabase } from './supabase';

export class ReviewError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ReviewError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  if (error.code === '23514') throw new ReviewError('Published reviews need a valid rating.', error.code); // check violation
  throw new ReviewError(error.message || fallback, error.code ?? null);
}

/** Viewer's own reviews (RLS lets authors see their drafts), newest activity first. */
export async function fetchMyReviews(userId: string, status?: ReviewStatus): Promise<Review[]> {
  let query = supabase.from('reviews').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) fail(error, 'Could not load your reviews.');
  return data;
}

/** One review per (user, game) — migration 000004. */
export async function fetchMyReviewForGame(userId: string, gameId: number): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();
  if (error) fail(error, 'Could not load your review.');
  return data;
}

/**
 * Saves a draft or publishes. Upserts on (user_id, game_id), so publishing a
 * draft promotes it in place and re-publishing edits the existing review.
 * The rating is written as canonical numeric + input scale + raw input; a new
 * input fully replaces the old one (derived scales are recomputed on read).
 */
export async function saveReview(userId: string, values: ReviewFormValues): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .upsert(
      {
        user_id: userId,
        game_id: values.gameId,
        ...reviewRatingColumns(values.rating),
        content: values.content.length > 0 ? values.content : null,
        status: values.status,
      },
      { onConflict: 'user_id,game_id' },
    )
    .select()
    .single();
  if (error) fail(error, values.status === 'published' ? 'Could not publish the review.' : 'Could not save the draft.');
  return data;
}

export async function deleteReview(userId: string, reviewId: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', userId);
  if (error) fail(error, 'Could not delete the review.');
}
