import { assertEquals } from '@std/assert';

import { GAME_TYPE, searchWhereClause } from './curation.ts';
import { rankGames } from './ranking.ts';
import { mapRemasters, remasterOriginals, summarizeRemasters } from './remasters.ts';

const unix = (year: number) => Date.UTC(year, 5, 1) / 1000;

Deno.test('mapRemasters: named remasters, oldest first, editions and duplicates dropped', () => {
  assertEquals(
    mapRemasters([
      { id: 3, name: 'Shadow of the Colossus HD', first_release_date: unix(2011), platforms: [{ abbreviation: 'PS3' }] },
      { id: 4, name: 'Remaster: Deluxe Edition', version_parent: 3, first_release_date: unix(2012) },
      { id: 5, name: ' Shadow of the Colossus HD ', first_release_date: unix(2013) },
      { id: 6, name: 'Undated Remaster', platforms: [{ name: 'Switch Thing' }, { abbreviation: 'NSW' }, { abbreviation: 'NSW' }] },
      7, // unexpanded id
      { id: 8 }, // no name
    ]),
    [
      { id: 3, name: 'Shadow of the Colossus HD', year: 2011, platforms: ['PS3'] },
      { id: 6, name: 'Undated Remaster', year: null, platforms: ['Switch Thing', 'NSW'] },
    ],
  );
  assertEquals(mapRemasters(undefined), []);
});

Deno.test('remasterOriginals: remaster hits point at their original', () => {
  const aliases = remasterOriginals([
    { id: 10, name: "Demon's Souls Remastered", game_type: GAME_TYPE.REMASTER, parent_game: { id: 1 } },
    { id: 11, name: "Demon's Souls HD", game_type: GAME_TYPE.REMASTER, parent_game: 1 },
    { id: 12, name: 'Edition of a remaster', game_type: GAME_TYPE.REMASTER, version_parent: 10, parent_game: 1 },
    { id: 13, name: 'Orphan remaster', game_type: GAME_TYPE.REMASTER },
    { id: 14, name: 'A main game', game_type: GAME_TYPE.MAIN_GAME, parent_game: 2 },
  ]);
  assertEquals([...aliases], [[1, ["Demon's Souls Remastered", "Demon's Souls HD"]]]);
});

Deno.test('search: a remaster name finds the original ahead of weaker matches', () => {
  const ranked = rankGames(
    [
      { id: 2, name: 'Souls Something Else', entryType: 'game' as const, total_rating_count: 5000 },
      { id: 1, name: "Demon's Souls", entryType: 'game' as const, total_rating_count: 100, aliases: ["Demon's Souls Remastered"] },
    ],
    "demon's souls remastered",
    10,
  );
  assertEquals(ranked.map((g) => g.id), [1, 2]);
});

Deno.test('search pre-filter: remasters are fetched only when asked', () => {
  assertEquals(
    searchWhereClause(new Map(), { withRemasters: true }),
    '(version_parent = null & first_release_date != null & game_type = (0,1,2,3,4,8,9,10))',
  );
  assertEquals(searchWhereClause(new Map()).includes(',9,'), false);
});

Deno.test('summarizeRemasters: count and known years for result cards', () => {
  assertEquals(
    summarizeRemasters([
      { id: 1, first_release_date: unix(2018) },
      { id: 2, first_release_date: unix(2011) },
      { id: 3, version_parent: 1, first_release_date: unix(2019) }, // an edition of a remaster
      { id: 4 }, // undated
      { id: 5, first_release_date: unix(2018) },
      9, // unexpanded id
    ]),
    { remasterCount: 4, remasterYears: [2011, 2018] },
  );
  assertEquals(summarizeRemasters(undefined), { remasterCount: 0, remasterYears: [] });
});
