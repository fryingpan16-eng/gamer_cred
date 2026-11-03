import { toFriendsList, type FriendshipRowWithPeople } from '../friends';

jest.mock('../supabase', () => ({ supabase: {} }));

const ME = 'me';
const person = (id: string, username: string) => ({ id, username, avatar_url: null });
const row = (id: string, from: string, to: string, status: FriendshipRowWithPeople['status'], created = '2026-11-01'): FriendshipRowWithPeople => ({
  id, user_id: from, friend_id: to, status, created_at: created,
  requester: from === ME ? person(ME, 'me') : person(from, from),
  recipient: to === ME ? person(ME, 'me') : person(to, to),
});

describe('toFriendsList', () => {
  const rows = [
    row('1', ME, 'zed', 'accepted'),
    row('2', 'amy', ME, 'accepted'),
    row('3', 'bob', ME, 'pending', '2026-11-02'),
    row('4', ME, 'cat', 'pending'),
    row('5', 'dan', ME, 'rejected'),
    { ...row('6', 'eve', ME, 'accepted'), requester: null }, // blocked / hidden
  ];

  it('own page: friends A–Z plus incoming and outgoing requests; declines and hidden players skipped', () => {
    const list = toFriendsList(rows, ME, true);
    expect(list.friends.map((f) => f.person.username)).toEqual(['amy', 'zed']);
    expect(list.incoming.map((f) => f.person.username)).toEqual(['bob']);
    expect(list.outgoing.map((f) => f.person.username)).toEqual(['cat']);
  });

  it("someone else's page: accepted friends only", () => {
    const list = toFriendsList(rows, ME, false);
    expect(list.friends).toHaveLength(2);
    expect(list.incoming).toEqual([]);
    expect(list.outgoing).toEqual([]);
  });
});
