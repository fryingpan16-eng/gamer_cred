import {
  activeFilterCount,
  applyTable,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  facet,
  nextSort,
  toTableRow,
  type RatingsTableSource,
} from '../ratingsTable';

const src = (over: Partial<RatingsTableSource> & { game_id: number; score: number }): RatingsTableSource => ({
  rating: { numeric: over.score, inputScale: 'numeric', input: String(over.score) },
  platform_id: null,
  rated_at: '2026-01-01T00:00:00Z',
  name: null,
  release_year: null,
  genres: [],
  developers: [],
  community_rating: null,
  review_id: null,
  ...over,
});

const ROWS = [
  src({ game_id: 1, score: 95, name: 'Halo 3', platform_id: 12, release_year: 2007, genres: ['Shooter'], developers: ['Bungie'], rated_at: '2026-03-01T00:00:00Z', review_id: 'r1' }),
  src({ game_id: 2, score: 40, name: 'Destiny', platform_id: 48, release_year: 2014, genres: ['Shooter', 'RPG'], developers: ['Bungie'], rated_at: '2026-02-01T00:00:00Z' }),
  src({ game_id: 3, score: 92, name: 'Celeste', platform_id: 130, release_year: 2018, genres: ['Platform'], developers: ['Maddy Makes Games'], rated_at: '2026-04-01T00:00:00Z' }),
  src({ game_id: 4, score: 70 }), // no metadata at all
].map((r) => toTableRow(r));

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('ratings spreadsheet', () => {
  it('rows derive every scale and bucket missing data as Unknown', () => {
    expect(ROWS[0]).toMatchObject({ tier: 'A+', stars: 4.5, platform: 'X360', year: 2007 });
    expect(ROWS[3]).toMatchObject({ name: 'Game #4', platform: 'Unknown', genres: ['Unknown'], developers: ['Unknown'] });
    expect(toTableRow(src({ game_id: 9, score: 50 }), 'From lookup').name).toBe('From lookup');
  });

  it('defaults to most recently rated first', () => {
    expect(names(applyTable(ROWS, EMPTY_FILTERS, DEFAULT_SORT))).toEqual(['Celeste', 'Halo 3', 'Destiny', 'Game #4']);
  });

  it('sorts any column both ways; blanks always last', () => {
    expect(names(applyTable(ROWS, EMPTY_FILTERS, { key: 'score', dir: 'desc' }))).toEqual(['Halo 3', 'Celeste', 'Game #4', 'Destiny']);
    expect(names(applyTable(ROWS, EMPTY_FILTERS, { key: 'score', dir: 'asc' }))).toEqual(['Destiny', 'Game #4', 'Celeste', 'Halo 3']);
    expect(names(applyTable(ROWS, EMPTY_FILTERS, { key: 'year', dir: 'asc' }))).toEqual(['Halo 3', 'Destiny', 'Celeste', 'Game #4']);
    expect(names(applyTable(ROWS, EMPTY_FILTERS, { key: 'year', dir: 'desc' }))).toEqual(['Celeste', 'Destiny', 'Halo 3', 'Game #4']);
    expect(names(applyTable(ROWS, EMPTY_FILTERS, { key: 'name', dir: 'asc' }))).toEqual(['Celeste', 'Destiny', 'Game #4', 'Halo 3']);
    expect(names(applyTable(ROWS, EMPTY_FILTERS, { key: 'review', dir: 'desc' }))[0]).toBe('Halo 3');
  });

  it('header clicks: new column starts in its natural direction, same column flips', () => {
    expect(nextSort(DEFAULT_SORT, 'score')).toEqual({ key: 'score', dir: 'desc' });
    expect(nextSort({ key: 'score', dir: 'desc' }, 'score')).toEqual({ key: 'score', dir: 'asc' });
    expect(nextSort({ key: 'score', dir: 'desc' }, 'name')).toEqual({ key: 'name', dir: 'asc' });
  });

  it('filters combine: text, platform, tier, genre (any of), reviewed, score range', () => {
    const f = (over: Partial<typeof EMPTY_FILTERS>) => names(applyTable(ROWS, { ...EMPTY_FILTERS, ...over }, { key: 'name', dir: 'asc' }));
    expect(f({ text: 'bungie' })).toEqual(['Destiny', 'Halo 3']);
    expect(f({ platforms: ['Switch', 'Unknown'] })).toEqual(['Celeste', 'Game #4']);
    expect(f({ tiers: ['A+'] })).toEqual(['Celeste', 'Halo 3']);
    expect(f({ genres: ['RPG', 'Platform'] })).toEqual(['Celeste', 'Destiny']);
    expect(f({ reviewed: 'reviewed' })).toEqual(['Halo 3']);
    expect(f({ reviewed: 'notReviewed', minScore: 50 })).toEqual(['Celeste', 'Game #4']);
    expect(f({ minScore: 60, maxScore: 93, genres: ['Platform'] })).toEqual(['Celeste']);
    expect(activeFilterCount({ ...EMPTY_FILTERS, text: ' x ', tiers: ['A'], maxScore: 50 })).toBe(3);
  });

  it('filter menus list each value with its count, Unknown last', () => {
    expect(facet(ROWS, (r) => r.genres)).toEqual([
      { value: 'Shooter', count: 2 },
      { value: 'Platform', count: 1 },
      { value: 'RPG', count: 1 },
      { value: 'Unknown', count: 1 },
    ]);
  });
});
