import type { ActivityFeedRow } from '@/types/database.types';

import { supabase } from './supabase';

export type FeedScope = 'friends' | 'community';

export const FEED_PAGE_SIZE = 20;

/** Keyset cursor: the last row's (occurred_at, item_key). */
export type FeedCursor = { before: string; beforeKey: string };

export type FeedPage = { items: ActivityFeedRow[]; next: FeedCursor | null };

export class FeedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedError';
  }
}

/**
 * Activity stream via the `activity_feed` RPC (migration 000006):
 *   friends   → accepted friends' published reviews + Now Playing slots
 *   community → everyone's published reviews
 * The friend set is resolved in SQL from `friendships` (status = 'accepted'),
 * so no friend-id list ever travels in the URL.
 */
export async function fetchFeedPage(scope: FeedScope, cursor: FeedCursor | null): Promise<FeedPage> {
  const { data, error } = await supabase.rpc('activity_feed', {
    p_scope: scope,
    p_before: cursor?.before ?? null,
    p_before_key: cursor?.beforeKey ?? null,
    p_limit: FEED_PAGE_SIZE,
  });
  if (error) throw new FeedError(error.message || 'Could not load the activity feed.');

  const last = data[data.length - 1];
  return {
    items: data,
    next: data.length === FEED_PAGE_SIZE && last ? { before: last.occurred_at, beforeKey: last.item_key } : null,
  };
}

/** How far back "trending" looks. */
export const TRENDING_DAYS = 14;

export type TrendingGame = {
  gameId: number;
  /** Different players who rated or reviewed it in the window. */
  players: number;
  activity: number;
  /** Average of everyone's current score (1–100), or null. */
  averageRating: number | null;
};

/** Games most players rated or reviewed in the last TRENDING_DAYS days (000020). */
export async function fetchTrendingGames(limit = 12): Promise<TrendingGame[]> {
  const { data, error } = await supabase.rpc('trending_games', { p_days: TRENDING_DAYS, p_limit: limit });
  if (error) throw new FeedError(error.message || 'Could not load trending games.');
  return data.map((r) => ({
    gameId: r.game_id,
    players: r.players,
    activity: r.activity,
    averageRating: r.average_rating === null ? null : Number(r.average_rating),
  }));
}

/**
 * Trending posts: recent published reviews of trending games (no likes or
 * comments exist yet, so a post trends with its game). Same rows as the feed.
 */
export async function fetchTrendingPosts(limit = 10): Promise<ActivityFeedRow[]> {
  const { data, error } = await supabase.rpc('trending_posts', { p_days: TRENDING_DAYS, p_limit: limit });
  if (error) throw new FeedError(error.message || 'Could not load trending posts.');
  return data;
}
