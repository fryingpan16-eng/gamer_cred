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
