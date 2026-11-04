/**
 * ♥ Likes (migration 000029): a one-tap way to show interest in a game without
 * rating or reviewing it. Readable by signed-in players (blocked players hidden),
 * owner-only writes, members only.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from './supabase';

function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.message || fallback);
}

export type GameLikeInfo = { count: number; liked: boolean };

/** How many players like a game, and whether the viewer (if a member) is one of them. */
export async function fetchGameLikes(gameId: number, viewerId: string | null): Promise<GameLikeInfo> {
  const [total, mine] = await Promise.all([
    supabase.from('game_likes').select('game_id', { count: 'exact', head: true }).eq('game_id', gameId),
    viewerId
      ? supabase.from('game_likes').select('game_id').eq('game_id', gameId).eq('user_id', viewerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (total.error) fail(total.error, 'Could not load likes.');
  if (mine.error) fail(mine.error, 'Could not load likes.');
  return { count: total.count ?? 0, liked: mine.data !== null };
}

export async function setGameLike(userId: string, gameId: number, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase
        .from('game_likes')
        .upsert({ user_id: userId, game_id: gameId }, { onConflict: 'user_id,game_id', ignoreDuplicates: true })
    : await supabase.from('game_likes').delete().eq('user_id', userId).eq('game_id', gameId);
  if (error) fail(error, liked ? 'Could not like the game.' : 'Could not remove the like.');
}

export const LIKED_GAMES_MAX = 1000;

/** A player's liked games, newest first (up to LIKED_GAMES_MAX), plus the total. */
export async function fetchLikedGames(userId: string): Promise<{ gameIds: number[]; total: number }> {
  const { data, error, count } = await supabase
    .from('game_likes')
    .select('game_id', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(LIKED_GAMES_MAX);
  if (error) fail(error, 'Could not load liked games.');
  return { gameIds: data.map((r) => Number(r.game_id)), total: count ?? data.length };
}
