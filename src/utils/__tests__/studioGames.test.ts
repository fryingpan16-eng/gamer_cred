import type { IgdbCompanyGame } from '@/types/igdb';

import { studioGames, studioRoleCounts } from '../studioGames';

const g = (id: number, name: string, releaseYear: number | null, rating: number | null, roles: IgdbCompanyGame['roles']): IgdbCompanyGame => ({
  kind: 'game', id, name, entryType: 'game', parentGame: null, collectionGames: [], slug: null, coverImageId: null,
  releaseYear, rating, platforms: [], genres: [], developers: [], roles,
});

const GAMES = [
  g(1, 'Metal', 1998, 94, ['developer', 'publisher']),
  g(2, 'Death', 2019, 82, ['developer']),
  g(3, 'Undated', null, null, ['publisher']),
  g(4, 'Bravo', 2019, null, ['publisher']),
];

describe('studioGames', () => {
  it('sorts newest / oldest with undated last', () => {
    expect(studioGames(GAMES, 'all', 'newest').map((x) => x.id)).toEqual([4, 2, 1, 3]);
    expect(studioGames(GAMES, 'all', 'oldest').map((x) => x.id)).toEqual([1, 4, 2, 3]);
  });
  it('sorts by rating with unrated last, then name', () => {
    expect(studioGames(GAMES, 'all', 'rating').map((x) => x.id)).toEqual([1, 2, 4, 3]);
  });
  it('filters by role', () => {
    expect(studioGames(GAMES, 'developer', 'name').map((x) => x.name)).toEqual(['Death', 'Metal']);
    expect(studioGames(GAMES, 'publisher', 'name').map((x) => x.name)).toEqual(['Bravo', 'Metal', 'Undated']);
  });
  it('counts roles', () => {
    expect(studioRoleCounts(GAMES)).toEqual({ all: 4, developer: 2, publisher: 3 });
  });
});
