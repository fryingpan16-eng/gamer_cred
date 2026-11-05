/**
 * Replays (migration 000040). "Mark as Replayed" on the game page adds a
 * game_replays row: date finished + platform, no score or text. A new review of
 * a game you already reviewed is a replay too (services/reviews.ts). Replays
 * are public like ratings and hidden when blocked.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

import { supabase } from './supabase';

export type GameReplay = Database['public']['Tables']['game_replays']['Row'];

export class ReplayError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ReplayError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  if (error.code === 'RP001') throw new ReplayError('The finish date can’t be in the future.', error.code);
  if (error.code === 'RP002') throw new ReplayError('That’s the most replays one game can hold.', error.code);
  throw new ReplayError(error.message || fallback, error.code ?? null);
}

/** Your game-page replays of one game, newest finish first. */
export async function fetchMyReplays(userId: string, gameId: number): Promise<GameReplay[]> {
  const { data, error } = await supabase
    .from('game_replays')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('finished_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) fail(error, 'Could not load your replays.');
  return data;
}

export async function addReplay(userId: string, gameId: number, finishedOn: string, platformId: number | null): Promise<GameReplay> {
  const { data, error } = await supabase
    .from('game_replays')
    .insert({ user_id: userId, game_id: gameId, finished_on: finishedOn, platform_id: platformId })
    .select()
    .single();
  if (error) fail(error, 'Could not mark it as replayed.');
  return data;
}

export async function deleteReplay(userId: string, replayId: string): Promise<void> {
  const { error } = await supabase.from('game_replays').delete().eq('id', replayId).eq('user_id', userId);
  if (error) fail(error, 'Could not remove that replay.');
}

export type MostReplayed = { gameId: number; replays: number };

/** A player's most replayed game (profile card), or null when they have no replays. */
export async function fetchMostReplayed(userId: string): Promise<MostReplayed | null> {
  const { data, error } = await supabase.rpc('most_replayed_game', { p_user_id: userId });
  if (error) fail(error, 'Could not load replays.');
  const row = data[0];
  return row ? { gameId: Number(row.game_id), replays: row.replays } : null;
}
