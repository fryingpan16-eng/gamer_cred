import { render, screen } from '@testing-library/react-native';

import { ScoreScales, scoreBoxScales } from '../ScoreScales';

const rating = { numeric: 92, inputScale: 'numeric' as const, input: '92' };

describe('game page score box scales', () => {
  it('default first, then 1–100, stars and tier; rounded only when it is the default', () => {
    expect(scoreBoxScales('stars')).toEqual(['stars', 'numeric', 'tier']);
    expect(scoreBoxScales('tier')).toEqual(['tier', 'numeric', 'stars']);
    expect(scoreBoxScales('numeric')).toEqual(['numeric', 'stars', 'tier']);
    expect(scoreBoxScales('rounded')).toEqual(['rounded', 'numeric', 'stars', 'tier']);
  });

  it('shows the score in every scale (community average keeps its decimal)', async () => {
    await render(<ScoreScales rating={rating} primaryScale="tier" numericText="91.6" />);
    expect(screen.getByText('A+')).toBeTruthy();
    expect(screen.getByText('Classic')).toBeTruthy();
    expect(screen.getByText(/^91\.6/)).toBeTruthy();
    expect(screen.getByText('4.5★')).toBeTruthy();
    expect(screen.queryByText('9/10')).toBeNull(); // rounded isn't the default
  });

  it('omitPrimary leaves the default scale to the caller (the quick-rating control)', async () => {
    await render(<ScoreScales rating={rating} primaryScale="stars" omitPrimary />);
    expect(screen.queryByText('4.5★')).toBeNull();
    expect(screen.getByText(/^92/)).toBeTruthy();
    expect(screen.getByText('A+')).toBeTruthy();
  });

  it('unrated keeps its shape with placeholders', async () => {
    await render(<ScoreScales rating={null} primaryScale="numeric" />);
    expect(screen.getAllByText('--')).toHaveLength(3);
  });
});
