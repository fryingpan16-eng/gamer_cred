import type { PostgrestError } from '@supabase/supabase-js';

import type { Friendship, Profile } from '@/types/database.types';

import { supabase } from './supabase';

/** Relationship of the signed-in user to another profile, from the viewer's side. */
export type FriendRelation =
  | { state: 'none' }
  | { state: 'friends'; friendshipId: string }
  | { state: 'outgoing'; friendshipId: string } // I sent a pending request
  | { state: 'incoming'; friendshipId: string } // they sent me a pending request
  /** `outgoing`: they declined my request. `incoming`: I declined theirs. */
  | { state: 'declined'; friendshipId: string; direction: 'outgoing' | 'incoming' };

export type UserSearchResult = Pick<Profile, 'id' | 'username' | 'avatar_url'> & { relation: FriendRelation };

export const USER_SEARCH_MIN_LENGTH = 2;
const USER_SEARCH_LIMIT = 25;

export class UserServiceError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'UserServiceError';
  }
}

function fail(error: PostgrestError, fallback: string): never {
  throw new UserServiceError(error.message || fallback, error.code ?? null);
}

/** Escape LIKE wildcards so "a_b" matches literally rather than "a?b". */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function relationFor(viewerId: string, otherId: string, rows: readonly Friendship[]): FriendRelation {
  const row = rows.find(
    (f) => (f.user_id === viewerId && f.friend_id === otherId) || (f.user_id === otherId && f.friend_id === viewerId),
  );
  if (!row) return { state: 'none' };
  if (row.status === 'accepted') return { state: 'friends', friendshipId: row.id };
  if (row.status === 'rejected') {
    return { state: 'declined', friendshipId: row.id, direction: row.user_id === viewerId ? 'outgoing' : 'incoming' };
  }
  return row.user_id === viewerId
    ? { state: 'outgoing', friendshipId: row.id }
    : { state: 'incoming', friendshipId: row.id };
}

/**
 * Username substring search over public profiles (RLS: public read), annotated
 * with the viewer's friendship state. Excludes the viewer. Prefix matches rank first.
 */
export async function searchUsers(
  rawTerm: string,
  viewerId: string,
  signal?: AbortSignal,
): Promise<UserSearchResult[]> {
  const term = rawTerm.trim();
  if (term.length < USER_SEARCH_MIN_LENGTH) return [];

  let profilesQuery = supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `%${escapeLike(term)}%`)
    .neq('id', viewerId)
    .order('username')
    .limit(USER_SEARCH_LIMIT);
  if (signal) profilesQuery = profilesQuery.abortSignal(signal);

  const { data: profiles, error } = await profilesQuery;
  if (error) fail(error, 'User search failed.');
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  // RLS returns accepted friendships plus any pending/rejected rows involving the viewer.
  let friendshipQuery = supabase
    .from('friendships')
    .select('*')
    .or(
      `and(user_id.eq.${viewerId},friend_id.in.(${ids.join(',')})),and(friend_id.eq.${viewerId},user_id.in.(${ids.join(',')}))`,
    );
  if (signal) friendshipQuery = friendshipQuery.abortSignal(signal);

  const { data: friendships, error: friendshipError } = await friendshipQuery;
  if (friendshipError) fail(friendshipError, 'Could not load friendship status.');

  const lowered = term.toLowerCase();
  return profiles
    .map((p) => ({ ...p, relation: relationFor(viewerId, p.id, friendships) }))
    .sort((a, b) => {
      const ap = a.username.toLowerCase().startsWith(lowered) ? 0 : 1;
      const bp = b.username.toLowerCase().startsWith(lowered) ? 0 : 1;
      return ap - bp || a.username.localeCompare(b.username);
    });
}

/** RLS: insert allowed only as requester with status 'pending'. */
export async function sendFriendRequest(viewerId: string, friendId: string): Promise<void> {
  if (viewerId === friendId) throw new UserServiceError('You cannot friend yourself.', null);
  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: viewerId, friend_id: friendId, status: 'pending' });
  if (!error) return;
  // 23505 = unique violation: a request already exists in one direction or the other.
  if (error.code === '23505') throw new UserServiceError('A friend request already exists with this player.', error.code);
  fail(error, 'Could not send friend request.');
}

/** Cancel a pending request or unfriend. RLS: either party may delete. */
export async function removeFriendship(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) fail(error, 'Could not update the friendship.');
}

/** RLS: only the recipient may update the row. */
export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', friendshipId);
  if (error) fail(error, 'Could not update friend request.');
}
