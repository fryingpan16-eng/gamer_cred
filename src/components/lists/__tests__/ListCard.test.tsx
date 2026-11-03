import { render, screen } from '@testing-library/react-native';

import type { ListSummary } from '@/services/lists';

import { ListCard } from '../ListCard';

jest.mock('@/services/supabase', () => ({ supabase: {} }));

const list: ListSummary = {
  id: 'l1',
  userId: 'u1',
  title: 'Best co-op nights',
  description: 'Couch classics',
  isRanked: true,
  isPublic: false,
  pinnedRank: 2,
  smartRule: null,
  updatedAt: '2026-11-01T00:00:00Z',
  owner: { id: 'u1', username: 'pan', avatar_url: null },
  gameCount: 12,
  previewGameIds: [1, 2],
};

describe('ListCard', () => {
  it('shows title, owner, count and badges, and links to the list', async () => {
    await render(<ListCard list={list} games={undefined} />);
    expect(screen.getByLabelText('List: Best co-op nights, by pan · 12 games. Open list')).toBeTruthy();
    expect(screen.getByText('Couch classics')).toBeTruthy();
    for (const badge of ['Featured', 'Ranked', 'Private']) expect(screen.getByText(badge)).toBeTruthy();
  });

  it('can hide the owner (on their own profile)', async () => {
    await render(<ListCard list={{ ...list, gameCount: 1 }} games={undefined} showOwner={false} layout="tile" />);
    expect(screen.getByLabelText('List: Best co-op nights, 1 game. Open list')).toBeTruthy();
  });
});
