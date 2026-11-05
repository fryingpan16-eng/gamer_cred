import type { PostgrestError } from '@supabase/supabase-js';

import type { Database, Review, ReviewStatus } from '@/types/database.types';
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

/** Your reviews of one game (drafts included), oldest first. Many per game since migration 000040. */
export async function fetchMyReviewsForGame(userId: string, gameId: number): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) fail(error, 'Could not load your reviews.');
  return data;
}

export type SaveReviewInput = ReviewFormValues & {
  /** The review being edited; absent for a new review (a new playthrough when an earlier review exists). */
  reviewId?: string;
};

/**
 * Saves a draft or publishes. With `reviewId` it updates that review (publishing
 * a draft promotes it in place); without, it adds a new review. The database
 * marks a review after an earlier one as a replay and keeps one draft per game
 * (migration 000040). The rating is written as canonical numeric + input scale
 * + raw input; a new input fully replaces the old one.
 */
export async function saveReview(userId: string, values: SaveReviewInput): Promise<Review> {
  const row = {
    ...reviewRatingColumns(values.rating),
    content: values.content.length > 0 ? values.content : null,
    status: values.status,
    platform_id: values.platformId,
    is_replay: values.isReplay,
    finished_on: values.isReplay ? values.finishedOn : null,
  };
  const { data, error } = values.reviewId
    ? await supabase.from('reviews').update(row).eq('id', values.reviewId).eq('user_id', userId).select().single()
    : await supabase
        .from('reviews')
        .insert({ user_id: userId, game_id: values.gameId, ...row })
        .select()
        .single();
  if (error) {
    if (error.code === '23505') throw new ReviewError('You already have a draft of this game. Resume it from Drafts.', error.code);
    if (error.code === 'RP001') throw new ReviewError('The finish date can’t be in the future.', error.code);
    fail(error, values.status === 'published' ? 'Could not publish the review.' : 'Could not save the draft.');
  }
  return data;
}

const REVIEW_DETAIL_SELECT = `
  id, user_id, game_id, rating, rating_input_scale, rating_input, platform_id, content, status,
  published_at, updated_at, is_replay, finished_on,
  author:profiles!reviews_user_id_fkey ( id, username, avatar_url )
` as const;

async function queryReviewById(reviewId: string) {
  return supabase.from('reviews').select(REVIEW_DETAIL_SELECT).eq('id', reviewId).maybeSingle();
}

export type ReviewDetail = NonNullable<Awaited<ReturnType<typeof queryReviewById>>['data']>;

/** One review with its author. RLS: published reviews for everyone, drafts only for their author. */
export async function fetchReviewById(reviewId: string): Promise<ReviewDetail | null> {
  const { data, error } = await queryReviewById(reviewId);
  if (error) fail(error, 'Could not load the review.');
  return data;
}

export async function deleteReview(userId: string, reviewId: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', reviewId).eq('user_id', userId);
  if (error) fail(error, 'Could not delete the review.');
}

export type Playthrough = Database['public']['Functions']['review_playthroughs']['Returns'][number];

/** The author's published reviews of this review's game, oldest first ("Review 2 of 3"). */
export async function fetchPlaythroughs(reviewId: string): Promise<Playthrough[]> {
  const { data, error } = await supabase.rpc('review_playthroughs', { p_review_id: reviewId });
  if (error) fail(error, 'Could not load the other reviews.');
  return data;
}
