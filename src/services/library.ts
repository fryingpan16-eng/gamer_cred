/**
 * The game Library (migration 000052): games a player owns, one row per
 * platform. Private unless the owner makes it public
 * (profiles.library_visibility). Independent of ratings and the backlog.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

import type { Profile } from '@/types/database.types';
import type { LibraryEntry, LibraryFormat } from '@/utils/library';
import { reviewRating } from '@/utils/ratingColumns';

import { supabase } from './supabase';

function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.message || fallback);
}

export type LibraryVisibility = 'public' | 'private';

/** Loaded in pages of this many (the API's row cap)… */
const PAGE = 1000;
/** …up to this many copies. */
export const LIBRARY_MAX = 5000;

/** A player's whole Library, newest first (empty when it's private and not yours). */
export async function fetchLibrary(userId: string): Promise<LibraryEntry[]> {
  const out: LibraryEntry[] = [];
  for (let from = 0; from < LIBRARY_MAX; from += PAGE) {
    const { data, error } = await supabase.rpc('library_of', { p_user_id: userId }).range(from, from + PAGE - 1);
    if (error) fail(error, 'Could not load the library.');
    for (const r of data) {
      out.push({
        gameId: Number(r.game_id),
        platformId: Number(r.platform_id),
        format: r.format,
        source: r.source,
        addedAt: r.added_at,
        name: r.name,
        releaseYear: r.release_year,
        generation: r.generation,
        rating: reviewRating(r),
      });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

const copySchema = z.object({
  gameId: z.number().int().positive(),
  platformId: z.number().int().positive(),
  format: z.enum(['physical', 'digital']).nullable(),
});
export type LibraryCopyInput = z.infer<typeof copySchema>;

/** Add copies (already-owned ones are left as they are). */
export async function addLibraryCopies(userId: string, copies: readonly LibraryCopyInput[]): Promise<void> {
  const rows = z
    .array(copySchema)
    .min(1)
    .max(500)
    .parse(copies)
    .map((c) => ({ user_id: userId, game_id: c.gameId, platform_id: c.platformId, format: c.format, source: 'manual' }));
  const { error } = await supabase.from('library_entries').upsert(rows, { onConflict: 'user_id,game_id,platform_id', ignoreDuplicates: true });
  if (error) fail(error, 'Could not add it to your library.');
}

/** Remove one copy, or every copy of a game when `platformId` is null. */
export async function removeLibraryCopy(userId: string, gameId: number, platformId: number | null): Promise<void> {
  let query = supabase.from('library_entries').delete().eq('user_id', userId).eq('game_id', gameId);
  if (platformId !== null) query = query.eq('platform_id', platformId);
  const { error } = await query;
  if (error) fail(error, 'Could not remove it from your library.');
}

export async function setLibraryFormat(userId: string, gameId: number, platformId: number, format: LibraryFormat | null): Promise<void> {
  const parsed = copySchema.parse({ gameId, platformId, format });
  const { error } = await supabase
    .from('library_entries')
    .update({ format: parsed.format })
    .eq('user_id', userId)
    .eq('game_id', parsed.gameId)
    .eq('platform_id', parsed.platformId);
  if (error) fail(error, 'Could not save the format.');
}

export async function updateLibraryVisibility(userId: string, visibility: LibraryVisibility): Promise<Profile> {
  const value = z.enum(['public', 'private']).parse(visibility);
  const { data, error } = await supabase.from('profiles').update({ library_visibility: value }).eq('id', userId).select().single();
  if (error) fail(error, 'Could not save your library privacy.');
  return data;
}
