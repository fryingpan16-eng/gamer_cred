import { render, screen } from '@testing-library/react-native';

import { RATING_TIERS } from '@/constants/ratingRubric';
import { THEME_NAMES, themePalette } from '@/constants/themes';
import { contrast, mix } from '@/utils/color';

import { ScoreScales, scoreBoxScales, tierBoxStyle } from '../ScoreScales';

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

  it('score boxes take the tier colour of their score; unrated boxes stay plain', () => {
    const olive = themePalette('olive');
    expect(tierBoxStyle({ numeric: 92, inputScale: 'numeric', input: '92' }, olive)?.borderColor).toBe('#3A7FC1'); // A+
    expect(tierBoxStyle({ numeric: 100, inputScale: 'numeric', input: '100' }, olive)?.borderColor).toBe('#7B3FE4'); // S**
    expect(tierBoxStyle(null, olive)).toBeUndefined();
  });

  it.each(THEME_NAMES)('%s: every tier box is strongly tinted yet keeps text readable', (name) => {
    const t = themePalette(name);
    for (const tier of RATING_TIERS) {
      const bg = tierBoxStyle({ numeric: tier.max, inputScale: 'numeric', input: String(tier.max) }, t)!.backgroundColor;
      expect(contrast(t.text, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(t.textBright, bg)).toBeGreaterThanOrEqual(7);
      expect(contrast(t.textMuted, bg)).toBeGreaterThanOrEqual(4.5);
      // clearly coloured: at least twice the old 10% tint
      expect(contrast(bg, t.dark)).toBeGreaterThan(contrast(mix(tier.color, t.dark, 0.2), t.dark) - 0.01);
    }
  });
});
