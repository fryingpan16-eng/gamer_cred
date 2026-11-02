import type { PostgrestError } from '@supabase/supabase-js';

import type { NowPlaying, NowPlayingSlot } from '@/types/database.types';

import { supabase } from './supabase';

export const NOW_PLAYING_SLOTS: readonly NowPlayingSlot[] = [1, 2, 3, 4];

export class NowPlayingError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'NowPlayingError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  // 23505: now_playing_unique_game — the game already occupies another slot.
  if (error.code === '23505') throw new NowPlayingError('That game is already in another Now Playing slot.', error.code);
  throw new NowPlayingError(error.message || fallback, error.code ?? null);
}

/** Public read (RLS): works for the viewer's own slots and other players' profiles. */
export async function fetchNowPlaying(userId: string): Promise<NowPlaying[]> {
  const { data, error } = await supabase
    .from('now_playing')
    .select('*')
    .eq('user_id', userId)
    .order('slot_index');
  if (error) fail(error, 'Could not load Now Playing.');
  return data;
}

/**
 * Puts a game into a slot (insert, or swap the slot's current game).
 * Swapping resets notes and score: they belong to the previous game.
 */
export async function assignGameToSlot(userId: string, slot: NowPlayingSlot, gameId: number): Promise<NowPlaying> {
  const { data, error } = await supabase
    .from('now_playing')
    .upsert(
      { user_id: userId, slot_index: slot, game_id: gameId, notes: null, preliminary_score: null },
      { onConflict: 'user_id,slot_index' },
    )
    .select()
    .single();
  if (error) fail(error, 'Could not assign the game.');
  return data;
}

export type SlotDetails = { notes?: string | null; preliminary_score?: number | null };

/** Running notes / preliminary score for an occupied slot. */
export async function updateSlotDetails(userId: string, slot: NowPlayingSlot, details: SlotDetails): Promise<NowPlaying> {
  const { data, error } = await supabase
    .from('now_playing')
    .update(details)
    .eq('user_id', userId)
    .eq('slot_index', slot)
    .select()
    .maybeSingle();
  if (error) fail(error, 'Could not save slot details.');
  if (!data) throw new NowPlayingError('This slot is empty — assign a game first.', null);
  return data;
}

export async function clearSlot(userId: string, slot: NowPlayingSlot): Promise<void> {
  const { error } = await supabase.from('now_playing').delete().eq('user_id', userId).eq('slot_index', slot);
  if (error) fail(error, 'Could not clear the slot.');
}
