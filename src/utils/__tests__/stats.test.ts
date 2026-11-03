import {
  distributionsByScale,
  eraBars,
  gamerProfileSummary,
  genreAverageBars,
  nameCountBars,
  platformBars,
  ratingTendency,
  summarizeHistogram,
  timelineBars,
  UNKNOWN_LABEL,
} from '@/utils/stats';

const HIST = [
  { score: 40, games: 2 },
  { score: 92, games: 1 },
  { score: 95, games: 1 },
  { score: 100, games: 1 },
];

describe('rating histogram', () => {
  it('summarizes count, average and median', () => {
    expect(summarizeHistogram(HIST)).toEqual({ count: 5, averageNumeric: 73.4, medianNumeric: 92 });
    expect(summarizeHistogram([{ score: 40, games: 1 }, { score: 60, games: 1 }]).medianNumeric).toBe(50);
    expect(summarizeHistogram([])).toEqual({ count: 0, averageNumeric: null, medianNumeric: null });
  });

  it('derives one distribution per display scale with the rubric', () => {
    const [numeric, tier, stars, rounded] = distributionsByScale(HIST);
    expect(numeric!.scale).toBe('numeric');
    // every score is its own row, 100 → 1 top to bottom
    expect(numeric!.orientation).toBe('horizontal');
    expect(numeric!.bars).toHaveLength(100);
    expect(numeric!.bars[0]!.label).toBe('100');
    expect(numeric!.bars[99]!.label).toBe('1');
    expect(numeric!.bars.find((b) => b.label === '40')!.value).toBe(2);
    expect(numeric!.bars.find((b) => b.label === '92')!.value).toBe(1);
    expect(numeric!.bars.find((b) => b.label === '41')!.value).toBe(0);
    expect(numeric!.averageLabel).toBe('73.4');

    // tier list, best → worst: S** … F; 100 is S** only, 92/95 are A+.
    expect(tier!.orientation).toBe('horizontal');
    expect(tier!.bars.map((b) => b.label)).toEqual(['S**', 'S', 'A+', 'A', 'B', 'C', 'D', 'F']);
    expect(tier!.bars[0]).toMatchObject({ color: '#7B3FE4', labelTextColor: '#FFFFFF' });
    expect(Object.fromEntries(tier!.bars.map((b) => [b.label, b.value]))).toMatchObject({ F: 2, 'A+': 2, 'S**': 1, S: 0 });
    expect(tier!.averageLabel).toBe('B · Good–Great'); // 73

    expect(stars!.bars).toHaveLength(10);
    // every rating chart is in tier colours: a bar is the colour of its tier
    const tierColor = Object.fromEntries(tier!.bars.map((b) => [b.label, b.color]));
    expect(numeric!.bars.find((b) => b.label === '92')!.color).toBe(tierColor['A+']);
    expect(numeric!.bars.find((b) => b.label === '100')!.color).toBe(tierColor['S**']);
    expect(numeric!.bars.find((b) => b.label === '40')!.color).toBe(tierColor.F);
    expect(stars!.bars.find((b) => b.label === '5★')!.color).toBe(tierColor.S);
    expect(stars!.bars.find((b) => b.label === '4.5★')!.color).toBe(tierColor['A+']);
    expect(stars!.bars.find((b) => b.label === '2★')!.color).toBe(tierColor.F);
    expect(rounded!.bars.find((b) => b.label === '8')!.color).toBe(tierColor.A);
    expect(rounded!.bars.find((b) => b.label === 'NOT GOOD')!.color).toBe(tierColor.F);
    expect(stars!.bars.find((b) => b.label === '2★')!.value).toBe(2); // 40 → 2★
    expect(stars!.averageLabel).toBe('3.6★'); // (2 + 2 + 4.5 + 4.5 + 5) / 5
    expect(rounded!.bars.find((b) => b.label === 'NOT GOOD')!.value).toBe(2);
    expect(rounded!.averageLabel).toBe('7/10');
  });

  it('classifies harsh vs generous critics', () => {
    expect(ratingTendency(85)).toBe('generous');
    expect(ratingTendency(70)).toBe('balanced');
    expect(ratingTendency(50)).toBe('harsh');
    expect(ratingTendency(null)).toBeNull();
  });
});

describe('buckets', () => {
  it('names platforms, puts Unknown last', () => {
    const bars = platformBars([
      { platform_id: null, games: 5 },
      { platform_id: 167, games: 3 },
      { platform_id: 6, games: 3 },
    ]);
    expect(bars.map((b) => [b.label, b.value])).toEqual([['PC (Windows)', 3], ['PlayStation 5', 3], [UNKNOWN_LABEL, 5]]);
  });

  it('sorts studios/genres by count with Unknown last', () => {
    expect(nameCountBars([{ name: 'Unknown', games: 9 }, { name: 'Valve', games: 2 }, { name: 'Bungie', games: 4 }], 'd').map((b) => b.label)).toEqual([
      'Bungie',
      'Valve',
      'Unknown',
    ]);
  });

  it('genre averages skip unrated genres and carry the tier', () => {
    const bars = genreAverageBars([
      { genre: 'Shooter', rated_games: 2, average_rating: 67.5 },
      { genre: 'Puzzle', rated_games: 0, average_rating: null },
      { genre: 'Platform', rated_games: 1, average_rating: 92 },
    ]);
    expect(bars.map((b) => [b.label, b.value])).toEqual([['Platform', 92], ['Shooter', 67.5]]);
    expect(bars[0]!.detail).toBe('A+ · 1 rated');
    expect(bars[0]!.color).toBe('#3A7FC1'); // A+ colour
    expect(bars[1]!.color).toBe('#FFE082'); // 67.5 → C colour
  });

  it('groups release years into decades (Unknown last)', () => {
    const rows = [
      { release_year: 1998, games: 1 },
      { release_year: 1991, games: 2 },
      { release_year: 2007, games: 1 },
      { release_year: null, games: 4 },
    ];
    expect(eraBars(rows, 'decade').map((b) => [b.label, b.value])).toEqual([['1990s', 3], ['2000s', 1], [UNKNOWN_LABEL, 4]]);
    expect(eraBars(rows, 'year').map((b) => b.label)).toEqual(['1991', '1998', '2007', UNKNOWN_LABEL]);
  });

  it('fills timeline gaps with zero and rolls up by year', () => {
    const rows = [
      { month: '2025-11-01', games: 2 },
      { month: '2026-02-01', games: 1 },
    ];
    expect(timelineBars(rows, 'month').map((b) => b.value)).toEqual([2, 0, 0, 1]); // Nov, Dec, Jan, Feb
    expect(timelineBars(rows, 'year').map((b) => [b.label, b.value])).toEqual([['2025', 2], ['2026', 1]]);
    expect(timelineBars([], 'month')).toEqual([]);
  });
});

describe('gamer profile summary', () => {
  it('writes a short blurb from the stats', () => {
    const lines = gamerProfileSummary({
      histogram: HIST,
      platforms: platformBars([{ platform_id: 167, games: 4 }, { platform_id: null, games: 9 }]),
      genres: nameCountBars([{ name: 'RPG', games: 3 }, { name: 'Unknown', games: 9 }], 'g'),
      genreAverages: genreAverageBars([
        { genre: 'RPG', rated_games: 2, average_rating: 90 },
        { genre: 'Shooter', rated_games: 1, average_rating: 40 },
      ]),
      decades: eraBars([{ release_year: 1998, games: 3 }], 'decade'),
      studios: nameCountBars([{ name: 'Square', games: 2 }], 'd'),
    });
    expect(lines).toEqual([
      'Your home turf is PlayStation 5, with 4 games logged there.', // Unknown never wins
      'You gravitate toward RPG games.',
      'Your favorite era is the 1990s.',
      'The studio you play most is Square.',
      'Across 5 ratings you average 73.4 (tier B) — a balanced critic.',
      'Your most common verdict is A+ (Classic).', // F and A+ tie 2–2: the better tier wins
      'You score RPG highest (avg 90) and Shooter lowest (avg 40).',
    ]);
  });

  it('is empty when nothing is logged', () => {
    expect(gamerProfileSummary({ histogram: [], platforms: [], genres: [], genreAverages: [], decades: [], studios: [] })).toEqual([]);
  });
});
