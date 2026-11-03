import type { NowPlayingVisibility } from '@/constants/privacy';

/**
 * Why a visitor can't see a player's Now Playing, or null if they can.
 * Mirrors the RLS policy in migration 000010 so the UI can explain an empty
 * result instead of implying the player isn't playing anything.
 */
export function nowPlayingHiddenReason(
  visibility: NowPlayingVisibility,
  viewer: { isOwner: boolean; isFriend: boolean },
): 'private' | 'friends' | null {
  if (viewer.isOwner || visibility === 'public') return null;
  if (visibility === 'friends') return viewer.isFriend ? null : 'friends';
  return 'private';
}
