import { fireEvent, render, screen } from '@testing-library/react-native';

import { toTableRow } from '@/utils/ratingsTable';

import { RatingsSpreadsheet } from '../RatingsSpreadsheet';

const row = (game_id: number, score: number, name: string, rated_at: string, extra: Partial<Parameters<typeof toTableRow>[0]> = {}) =>
  toTableRow({
    game_id,
    rating: { numeric: score, inputScale: 'numeric', input: String(score) },
    platform_id: null,
    rated_at,
    name,
    release_year: null,
    genres: [],
    developers: [],
    community_rating: null,
    review_id: null,
    ...extra,
  });

const ROWS = [
  row(1, 95, 'Halo 3', '2026-03-01T00:00:00Z', { developers: ['Bungie'] }),
  row(2, 40, 'Destiny', '2026-02-01T00:00:00Z', { developers: ['Bungie'] }),
  row(3, 92, 'Celeste', '2026-04-01T00:00:00Z'),
];

const order = () => screen.getAllByRole('link').map((el) => String(el.props.accessibilityLabel).split(':')[0]);

describe('RatingsSpreadsheet', () => {
  it('owner / friend: column headers sort, and the same header reverses', async () => {
    await render(<RatingsSpreadsheet rows={ROWS} canSortFilter ownerName="You" />);
    expect(order()).toEqual(['Celeste', 'Halo 3', 'Destiny']); // newest rated first
    await fireEvent.press(screen.getByLabelText('Sort by 1–100'));
    expect(order()).toEqual(['Halo 3', 'Celeste', 'Destiny']);
    await fireEvent.press(screen.getByLabelText('Sort by 1–100, descending'));
    expect(order()).toEqual(['Destiny', 'Celeste', 'Halo 3']);
    await fireEvent.press(screen.getByLabelText('Sort by Game'));
    expect(order()).toEqual(['Celeste', 'Destiny', 'Halo 3']);
  });

  it('owner / friend: search filters the rows and shows the count', async () => {
    await render(<RatingsSpreadsheet rows={ROWS} canSortFilter ownerName="You" />);
    await fireEvent.changeText(screen.getByLabelText('Search ratings'), 'bungie');
    expect(order()).toEqual(['Halo 3', 'Destiny']);
    expect(screen.getByText(/2 of 3 games/)).toBeTruthy();
  });

  it('everyone else: newest first, no sort or filter controls', async () => {
    await render(<RatingsSpreadsheet rows={ROWS} canSortFilter={false} ownerName="sam" />);
    expect(order()).toEqual(['Celeste', 'Halo 3', 'Destiny']);
    expect(screen.queryByLabelText('Search ratings')).toBeNull();
    expect(screen.queryByLabelText('Sort by 1–100')).toBeNull();
    expect(screen.getByText(/sam and their friends can sort and filter/)).toBeTruthy();
  });
});
