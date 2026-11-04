import type { PostgrestError } from '@supabase/supabase-js';

import type { FavoriteRank, Friendship, Profile, Review, UserFavorite, UserPlatform } from '@/types/database.types';
import type { RatingScale } from '@/constants/ratingRubric';
import type { NowPlayingVisibility } from '@/constants/privacy';
import type { ThemeName } from '@/constants/themes';

import { supabase } from './supabase';
import { relationFor, type FriendRelation } from './users';

export class ProfileError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'ProfileError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  if (error.code === '23505') throw new ProfileError('That conflicts with something already on your profile.', error.code);
  throw new ProfileError(error.message || fallback, error.code ?? null);
}

// -----------------------------------------------------------------------------
// Profiles (public read; owner update)
// -----------------------------------------------------------------------------

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) fail(error, 'Could not load the profile.');
  return data;
}

/** Primary rating input scale. Existing ratings are untouched; only entry/display changes. */
export async function updatePrimaryRatingScale(userId: string, scale: RatingScale): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ primary_rating_scale: scale })
    .eq('id', userId)
    .select()
    .single();
  if (error) fail(error, 'Could not save your rating scale.');
  return data;
}

/** RetroGamingPC colour palette preference (synced across devices). */
export async function updateUiTheme(userId: string, theme: ThemeName): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update({ ui_theme: theme }).eq('id', userId).select().single();
  if (error) fail(error, 'Could not save your colour theme.');
  return data;
}

/** Who can see your Now Playing: everyone, friends only, or only you (RLS, migration 000010). */
export async function updateNowPlayingVisibility(userId: string, visibility: NowPlayingVisibility): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ now_playing_visibility: visibility })
    .eq('id', userId)
    .select()
    .single();
  if (error) fail(error, 'Could not save your privacy setting.');
  return data;
}

// -----------------------------------------------------------------------------
// Top 4 favorites (public read; owner writes via RPCs for atomic moves)
// -----------------------------------------------------------------------------

export async function fetchFavorites(userId: string): Promise<UserFavorite[]> {
  const { data, error } = await supabase.from('user_favorites').select('*').eq('user_id', userId).order('rank');
  if (error) fail(error, 'Could not load favorites.');
  return data;
}

/** Puts a game at a rank; if it is already elsewhere in the Top 4 it moves (migration 000005). */
export async function setFavorite(rank: FavoriteRank, gameId: number): Promise<void> {
  const { error } = await supabase.rpc('set_favorite', { p_rank: rank, p_game_id: gameId });
  if (error) fail(error, 'Could not set the favorite.');
}

export async function removeFavorite(userId: string, rank: FavoriteRank): Promise<void> {
  const { error } = await supabase.from('user_favorites').delete().eq('user_id', userId).eq('rank', rank);
  if (error) fail(error, 'Could not remove the favorite.');
}

// -----------------------------------------------------------------------------
// Platform roster (public read; owner writes)
// -----------------------------------------------------------------------------

export async function fetchPlatforms(userId: string): Promise<UserPlatform[]> {
  const { data, error } = await supabase
    .from('user_platforms')
    .select('*')
    .eq('user_id', userId)
    .order('is_main', { ascending: false })
    .order('platform_id');
  if (error) fail(error, 'Could not load the platform roster.');
  return data;
}

export async function addPlatform(userId: string, platformId: number): Promise<void> {
  const { error } = await supabase
    .from('user_platforms')
    .upsert({ user_id: userId, platform_id: platformId }, { onConflict: 'user_id,platform_id', ignoreDuplicates: true });
  if (error) fail(error, 'Could not add the platform.');
}

export async function removePlatform(userId: string, platformId: number): Promise<void> {
  const { error } = await supabase.from('user_platforms').delete().eq('user_id', userId).eq('platform_id', platformId);
  if (error) fail(error, 'Could not remove the platform.');
}

/** Atomic swap of the Main badge (migration 000005). `null` clears it. */
export async function setMainPlatform(platformId: number | null): Promise<void> {
  const { error } = await supabase.rpc('set_main_platform', { p_platform_id: platformId });
  if (error) fail(error, 'Could not set your main platform.');
}

/** Specific devices owned for a roster entry (e.g. PC Handhelds). Pass a validated list. */
export async function updatePlatformDevices(userId: string, platformId: number, devices: string[]): Promise<void> {
  const { error } = await supabase
    .from('user_platforms')
    .update({ devices })
    .eq('user_id', userId)
    .eq('platform_id', platformId);
  if (error) fail(error, 'Could not save your devices.');
}

export async function updatePcSpecs(userId: string, platformId: number, pcSpecs: string | null): Promise<void> {
  const { error } = await supabase
    .from('user_platforms')
    .update({ pc_specs: pcSpecs })
    .eq('user_id', userId)
    .eq('platform_id', platformId);
  if (error) fail(error, 'Could not save PC specs.');
}

// -----------------------------------------------------------------------------
// Friendships
// -----------------------------------------------------------------------------

/** Viewer ↔ other relationship. RLS exposes pending/rejected rows only to the two parties. */
export async function fetchRelation(viewerId: string, otherId: string): Promise<FriendRelation> {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`and(user_id.eq.${viewerId},friend_id.eq.${otherId}),and(user_id.eq.${otherId},friend_id.eq.${viewerId})`);
  if (error) fail(error, 'Could not load friendship status.');
  return relationFor(viewerId, otherId, data as Friendship[]);
}

/** Accepted friendships are public, so any viewer can count them. */
export async function fetchFriendCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friendships')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  if (error) fail(error, 'Could not count friends.');
  return count ?? 0;
}

// -----------------------------------------------------------------------------
// Reviews shown on profiles (RLS: only published ones are visible to others)
// -----------------------------------------------------------------------------

export async function fetchPublishedReviews(userId: string, limit = 10): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) fail(error, 'Could not load reviews.');
  return data;
}
