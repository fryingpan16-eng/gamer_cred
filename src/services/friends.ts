import { isUuid } from '@/utils/ids';

import { supabase } from './supabase';

type PersonRef = { id: string; username: string; avatar_url: string | null };

/** One row on a friends page. `incoming` / `outgoing` are pending requests (owner only). */
export type FriendListEntry = {
  friendshipId: string;
  kind: 'friend' | 'incoming' | 'outgoing';
  person: PersonRef;
  /** When the friendship (or request) was created. */
  since: string;
};

export type FriendsList = {
  friends: FriendListEntry[];
  incoming: FriendListEntry[];
  outgoing: FriendListEntry[];
};

export type FriendshipRowWithPeople = {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  requester: PersonRef | PersonRef[] | null;
  recipient: PersonRef | PersonRef[] | null;
};

const one = (p: PersonRef | PersonRef[] | null): PersonRef | null => (Array.isArray(p) ? (p[0] ?? null) : p);

/**
 * Splits a player's friendship rows into friends and (for their own page) pending
 * requests. Rows whose other player isn't visible (blocked, deleted) are skipped;
 * declined requests stay private and never show.
 */
export function toFriendsList(rows: readonly FriendshipRowWithPeople[], userId: string, isOwner: boolean): FriendsList {
  const out: FriendsList = { friends: [], incoming: [], outgoing: [] };
  for (const row of rows) {
    const iRequested = row.user_id === userId;
    if (!iRequested && row.friend_id !== userId) continue;
    const person = one(iRequested ? row.recipient : row.requester);
    if (!person) continue;
    const base = { friendshipId: row.id, person, since: row.created_at };
    if (row.status === 'accepted') out.friends.push({ ...base, kind: 'friend' });
    else if (isOwner && row.status === 'pending') {
      if (iRequested) out.outgoing.push({ ...base, kind: 'outgoing' });
      else out.incoming.push({ ...base, kind: 'incoming' });
    }
  }
  const byName = (a: FriendListEntry, b: FriendListEntry) => a.person.username.localeCompare(b.person.username);
  out.friends.sort(byName);
  out.incoming.sort((a, b) => b.since.localeCompare(a.since));
  out.outgoing.sort((a, b) => b.since.localeCompare(a.since));
  return out;
}

/**
 * A player's friends. Accepted friendships are public (RLS); pending requests are
 * only returned to the two players involved, so they appear on your own page only.
 */
export async function fetchFriendsList(userId: string, viewerId: string): Promise<FriendsList> {
  if (!isUuid(userId)) throw new Error('That player doesn’t exist.');
  const { data, error } = await supabase
    .from('friendships')
    .select(
      `id, user_id, friend_id, status, created_at,
       requester:profiles!friendships_user_id_fkey ( id, username, avatar_url ),
       recipient:profiles!friendships_friend_id_fkey ( id, username, avatar_url )`,
    )
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message || 'Could not load friends.');
  return toFriendsList((data ?? []) as unknown as FriendshipRowWithPeople[], userId, userId === viewerId);
}
