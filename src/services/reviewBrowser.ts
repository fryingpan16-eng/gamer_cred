/**
 * The review system (migration 000030): the browser's paged, sorted lists, and
 * private review likes. Every review preview in the app is a ReviewCardData.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { ActivityFeedRow, Review } from '@/types/database.types';
import { reviewRating } from '@/utils/ratingColumns';
import type { StoredRating } from '@/utils/rating';

import { supabase } from './supabase';

function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.message || fallback);
}

/** Everything the shared ReviewCard shows, from whichever query loaded the review. */
export type ReviewCardData = {
  id: string;
  userId: string;
  gameId: number;
  author: { id: string; username: string; avatar_url: string | null } | null;
  rating: StoredRating | null;
  platformId: number | null;
  content: string | null;
  /** When it was published (falls back to the last edit). */
  date: string | null;
};

export function cardFromFeedRow(row: ActivityFeedRow): ReviewCardData {
  return {
    id: row.review_id ?? row.item_key,
    userId: row.actor_id,
    gameId: Number(row.game_id),
    author: { id: row.actor_id, username: row.actor_username, avatar_url: row.actor_avatar_url },
    rating: reviewRating(row),
    platformId: null,
    content: row.excerpt,
    date: row.occurred_at,
  };
}

/** A profile's own reviews (the author is the profile, so it isn't repeated). */
export function cardFromReview(
  r: Pick<
    Review,
    | 'id'
    | 'user_id'
    | 'game_id'
    | 'rating'
    | 'rating_input_scale'
    | 'rating_input'
    | 'platform_id'
    | 'content'
    | 'published_at'
    | 'updated_at'
  >,
): ReviewCardData {
  return {
    id: r.id,
    userId: r.user_id,
    gameId: Number(r.game_id),
    author: null,
    rating: reviewRating(r),
    platformId: r.platform_id,
    content: r.content,
    date: r.published_at ?? r.updated_at,
  };
}

export type ReviewScope = 'community' | 'friends';
export type ReviewSort = 'popular' | 'recent' | 'highest' | 'lowest';
export const REVIEW_BROWSER_PAGE = 20;

export async function browseGameReviews(
  gameId: number,
  scope: ReviewScope,
  sort: ReviewSort,
  page: number,
  pageSize = REVIEW_BROWSER_PAGE,
): Promise<{ reviews: ReviewCardData[]; nextPage: number | null }> {
  const { data, error } = await supabase.rpc('game_reviews_browse', {
    p_game_id: gameId,
    p_scope: scope,
    p_sort: sort,
    p_offset: page * pageSize,
    p_limit: pageSize,
  });
  if (error) fail(error, 'Could not load reviews.');
  return {
    reviews: data.map((r) => ({
      id: r.id,
      userId: r.user_id,
      gameId: Number(r.game_id),
      author: { id: r.user_id, username: r.author_username, avatar_url: r.author_avatar_url },
      rating: reviewRating(r),
      platformId: r.platform_id === null ? null : Number(r.platform_id),
      content: r.content,
      date: r.published_at ?? r.updated_at,
    })),
    nextPage: data.length === pageSize ? page + 1 : null,
  };
}

/** Your ♥ on a review, and (only on your own reviews) its like count. */
export type ReviewLikeInfo = { liked: boolean; count: number | null };

export async function fetchReviewLikeInfo(reviewIds: readonly string[]): Promise<Map<string, ReviewLikeInfo>> {
  if (reviewIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc('review_like_info', { p_review_ids: [...reviewIds] });
  if (error) fail(error, 'Could not load likes.');
  return new Map(data.map((r) => [r.review_id, { liked: r.liked, count: r.like_count }]));
}

export async function setReviewLike(userId: string, reviewId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase
        .from('review_likes')
        .upsert({ user_id: userId, review_id: reviewId }, { onConflict: 'user_id,review_id', ignoreDuplicates: true })
    : await supabase.from('review_likes').delete().eq('user_id', userId).eq('review_id', reviewId);
  if (error) fail(error, liked ? 'Could not like the review.' : 'Could not remove the like.');
}
