/**
 * The want-to-play backlog (migration 000035). Newest first. Public or private
 * per player (profiles.backlog_visibility); starting a game in Now Playing takes it
 * off the backlog (database trigger).
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { Profile } from '@/types/database.types';

import { supabase } from './supabase';

function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.message || fallback);
}

export type BacklogVisibility = 'public' | 'private';
export const BACKLOG_MAX = 1000;

/** A player's backlog (empty when it's private and not yours). */
export async function fetchBacklog(userId: string): Promise<{ gameIds: number[]; total: number }> {
  const { data, error, count } = await supabase
    .from('game_backlog')
    .select('game_id', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(BACKLOG_MAX);
  if (error) fail(error, 'Could not load the backlog.');
  return { gameIds: data.map((r) => Number(r.game_id)), total: count ?? data.length };
}

export async function setBacklogEntry(userId: string, gameId: number, inBacklog: boolean): Promise<void> {
  const { error } = inBacklog
    ? await supabase
        .from('game_backlog')
        .upsert({ user_id: userId, game_id: gameId }, { onConflict: 'user_id,game_id', ignoreDuplicates: true })
    : await supabase.from('game_backlog').delete().eq('user_id', userId).eq('game_id', gameId);
  if (error) fail(error, inBacklog ? 'Could not add it to your backlog.' : 'Could not remove it from your backlog.');
}

export async function updateBacklogVisibility(userId: string, visibility: BacklogVisibility): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ backlog_visibility: visibility }).eq('id', userId).select().single();
  if (error) fail(error, 'Could not save your backlog privacy.');
  return data;
}
