import {
  filterLibrary,
  groupLibrary,
  libraryCounts,
  libraryGenerations,
  libraryPlatformIds,
  NO_LIBRARY_FILTERS,
  ownablePlatformIds,
  sortLibrary,
  type LibraryEntry,
} from '@/utils/library';

const entry = (over: Partial<LibraryEntry> & Pick<LibraryEntry, 'gameId' | 'platformId' | 'addedAt'>): LibraryEntry => ({
  format: null,
  source: 'manual',
  name: `Game ${over.gameId}`,
  releaseYear: null,
  generation: null,
  rating: null,
  ...over,
});

// Newest first, as library_of returns them.
const entries: LibraryEntry[] = [
  entry({ gameId: 3, platformId: 130, addedAt: '2026-03-01', name: 'cave story', releaseYear: 2004, generation: '8', format: 'digital' }),
  entry({ gameId: 1, platformId: 48, addedAt: '2026-02-01', name: 'Okami', releaseYear: 2006, generation: '8', format: 'digital' }),
  entry({ gameId: 2, platformId: 6, addedAt: '2026-01-15', name: null, releaseYear: null, generation: 'pc' }),
  entry({ gameId: 1, platformId: 8, addedAt: '2026-01-01', name: 'Okami', releaseYear: 2006, generation: '6', format: 'physical' }),
];

describe('groupLibrary', () => {
  it('one row per game, first-added date, copies oldest first, newest game first', () => {
    const games = groupLibrary(entries);
    expect(games.map((g) => g.gameId)).toEqual([3, 2, 1]);
    const okami = games.find((g) => g.gameId === 1)!;
    expect(okami.addedAt).toBe('2026-01-01');
    expect(okami.copies.map((c) => c.platformId)).toEqual([8, 48]);
  });
});

describe('filterLibrary', () => {
  const games = groupLibrary(entries);
  const ids = (f: Partial<typeof NO_LIBRARY_FILTERS>, nameOf?: (id: number) => string | null) =>
    filterLibrary(games, { ...NO_LIBRARY_FILTERS, ...f }, nameOf).map((g) => g.gameId);

  it('no filters: everything', () => expect(ids({})).toEqual([3, 2, 1]));
  it('platform, generation and format', () => {
    expect(ids({ platformId: 8 })).toEqual([1]);
    expect(ids({ generation: '8' })).toEqual([3, 1]);
    expect(ids({ format: 'physical' })).toEqual([1]);
  });
  it('copy filters apply to the same copy', () => {
    expect(ids({ generation: '6', format: 'digital' })).toEqual([]); // Okami's Gen 6 copy is physical
    expect(ids({ generation: '8', format: 'digital' })).toEqual([3, 1]);
  });
  it('title search ignores case and falls back to looked-up names', () => {
    expect(ids({ query: 'CAVE' })).toEqual([3]);
    expect(ids({ query: 'doom' })).toEqual([]);
    expect(ids({ query: 'doom' }, (id) => (id === 2 ? 'DOOM' : null))).toEqual([2]);
  });
});

describe('sortLibrary', () => {
  const games = groupLibrary(entries);
  const nameOf = (id: number) => (id === 2 ? 'Doom' : null);
  it('date added, title (A–Z, any case), release year (unknown last)', () => {
    expect(sortLibrary(games, 'added').map((g) => g.gameId)).toEqual([3, 2, 1]);
    expect(sortLibrary(games, 'title', nameOf).map((g) => g.gameId)).toEqual([3, 2, 1]);
    expect(sortLibrary(games, 'year').map((g) => g.gameId)).toEqual([1, 3, 2]);
  });
});

describe('counts and filter options', () => {
  it('games vs copies', () => expect(libraryCounts(entries)).toEqual({ games: 3, copies: 4 }));
  it('platforms in catalogue order', () => expect(libraryPlatformIds(entries)).toEqual([6, 48, 8, 130]));
  it('console generations only, Gen 1 → 9', () => expect(libraryGenerations(entries)).toEqual(['6', '8']));
});

describe('ownablePlatformIds', () => {
  it('release platforms + remaster/version platforms, catalogue only, no duplicates', () => {
    expect(
      ownablePlatformIds({
        releasePlatformIds: [8, 9999, 6],
        remasters: [{ platformIds: [48, 6] }, {}],
        versions: [{ platformIds: [130] }],
      }),
    ).toEqual([8, 6, 48, 130]);
  });
  it('never PC Handheld; empty without data', () => {
    expect(ownablePlatformIds({ releasePlatformIds: [-1] })).toEqual([]);
    expect(ownablePlatformIds({})).toEqual([]);
  });
});
