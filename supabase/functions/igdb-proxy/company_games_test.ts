import { assertEquals } from '@std/assert';

import type { IgdbGameResult } from '../_shared/igdb-contract.ts';
import { chunk, companyGameIds, tagCompanyGames } from './company_games.ts';

const game = (id: number, name: string, releaseYear: number | null): IgdbGameResult => ({
  kind: 'game',
  id,
  name,
  entryType: 'game',
  parentGame: null,
  collectionGames: [],
  slug: null,
  coverImageId: null,
  releaseYear,
  rating: null,
  platforms: [],
  genres: [],
  developers: [],
  remasterCount: 0,
  remasterYears: [],
});

Deno.test('companyGameIds: developed first, de-duplicated, capped', () => {
  assertEquals(companyGameIds([3, 1], [1, 2], 10), { ids: [3, 1, 2], truncated: false });
  assertEquals(companyGameIds([3, 1], [1, 2], 2), { ids: [3, 1], truncated: true });
  assertEquals(companyGameIds(undefined, undefined, 5), { ids: [], truncated: false });
});

Deno.test('chunk splits into IGDB-sized pages', () => {
  assertEquals(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assertEquals(chunk([], 2), []);
});

Deno.test('tagCompanyGames: roles, newest first, undated last, unrelated dropped', () => {
  const tagged = tagCompanyGames(
    [game(1, 'Old', 2001), game(2, 'New', 2019), game(3, 'Undated', null), game(4, 'Also 2019', 2019), game(9, 'Stray', 2020)],
    [1, 2, 3],
    [2, 4],
  );
  assertEquals(
    tagged.map((g) => [g.name, g.roles]),
    [
      ['Also 2019', ['publisher']],
      ['New', ['developer', 'publisher']],
      ['Old', ['developer']],
      ['Undated', ['developer']],
    ],
  );
});
