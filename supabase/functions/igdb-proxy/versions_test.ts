/**
 * Other versions (IGDB "expanded games": Director's Cut…) fold into their
 * original; a few (Persona 5 Royal…) keep their own entry.
 */
import { assertEquals } from '@std/assert';

import {
  classifyGame,
  curateGames,
  foldedVersions,
  GAME_TYPE,
  isKeptSeparate,
  KEEP_SEPARATE_VERSION_NAMES,
  normalizeVersionName,
  versionOriginalOf,
  type CurationContext,
  type CurationFields,
} from './curation.ts';
import { mapVersions, remasterOriginals, shortVersionName, versionNames } from './remasters.ts';

const D = 1_600_000_000;
const ON_STEAM = { external_games: [{ external_game_source: 1 }] };
const unix = (year: number) => Date.UTC(year, 5, 1) / 1000;

const DEATH_STRANDING = { id: 19564, name: 'Death Stranding', game_type: GAME_TYPE.MAIN_GAME, first_release_date: D, ...ON_STEAM };
const DS_DIRECTORS_CUT = {
  id: 152063,
  name: "Death Stranding Director's Cut",
  game_type: GAME_TYPE.EXPANDED_GAME,
  parent_game: { id: 19564, name: 'Death Stranding' },
  first_release_date: D,
  ...ON_STEAM,
} satisfies CurationFields;
const GHOST_DIRECTORS_CUT = {
  id: 153000,
  name: "Ghost of Tsushima: Director's Cut",
  game_type: GAME_TYPE.EXPANDED_GAME,
  parent_game: 26192,
  first_release_date: D,
  ...ON_STEAM,
} satisfies CurationFields;
const P5_ROYAL = {
  id: 114283,
  name: 'Persona 5 Royal',
  game_type: GAME_TYPE.EXPANDED_GAME,
  parent_game: { id: 9927, name: 'Persona 5' },
  first_release_date: D,
  ...ON_STEAM,
} satisfies CurationFields;
const ORPHAN_EXPANDED = { id: 5, name: 'Some Expanded Game', game_type: GAME_TYPE.EXPANDED_GAME, first_release_date: D, ...ON_STEAM };

const ctx = (overrides = new Map<number, 'include' | 'exclude'>()): CurationContext => ({ overrides, collections: new Map() });

Deno.test("a Director's Cut folds into its original", () => {
  assertEquals(classifyGame(DS_DIRECTORS_CUT, ctx()), { keep: false, reason: 'other_version' });
  assertEquals(classifyGame(GHOST_DIRECTORS_CUT, ctx()), { keep: false, reason: 'other_version' });
  assertEquals(versionOriginalOf(DS_DIRECTORS_CUT), 19564);
  assertEquals(versionOriginalOf(GHOST_DIRECTORS_CUT), 26192); // bare parent id
  assertEquals(classifyGame(DEATH_STRANDING, ctx()), { keep: true, entryType: 'game' });
});

Deno.test('Persona re-releases keep their own entry', () => {
  assertEquals(classifyGame(P5_ROYAL, ctx()), { keep: true, entryType: 'game' });
  assertEquals(versionOriginalOf(P5_ROYAL), null);
  for (const name of KEEP_SEPARATE_VERSION_NAMES) assertEquals(isKeptSeparate({ name }), true, name);
  assertEquals(isKeptSeparate({ name: 'Persona 5: Royal' }), true); // punctuation doesn't matter
  assertEquals(isKeptSeparate({ name: 'Persona 5' }), false);
  assertEquals(normalizeVersionName("  Ghost of Tsushima: Director’s Cut "), 'ghost of tsushima directors cut');
});

Deno.test('an expanded game with no known original stays; overrides win', () => {
  assertEquals(classifyGame(ORPHAN_EXPANDED, ctx()), { keep: true, entryType: 'game' });
  assertEquals(classifyGame(DS_DIRECTORS_CUT, ctx(new Map([[152063, 'include']]))), { keep: true, entryType: 'game' });
  assertEquals(classifyGame(DS_DIRECTORS_CUT, ctx(new Map([[152063, 'exclude']]))), { keep: false, reason: 'override_exclude' });
});

Deno.test('curateGames reports folded versions with their original', async () => {
  const { kept, dropped } = await curateGames([DEATH_STRANDING, DS_DIRECTORS_CUT, P5_ROYAL], {
    getOverrides: () => Promise.resolve(new Map()),
    checkCollections: () => Promise.resolve(new Map()),
  });
  assertEquals(kept.map((g) => g.id), [19564, 114283]);
  assertEquals(foldedVersions(dropped), new Map([[152063, 19564]]));
});

Deno.test("search: a version's name finds its original; kept-separate ones don't", () => {
  const aliases = remasterOriginals([DS_DIRECTORS_CUT, GHOST_DIRECTORS_CUT, P5_ROYAL, DEATH_STRANDING]);
  assertEquals(aliases.get(19564), ["Death Stranding Director's Cut"]);
  assertEquals(aliases.get(26192), ["Ghost of Tsushima: Director's Cut"]);
  assertEquals(aliases.has(9927), false);
});

Deno.test('version lists and short names', () => {
  const raw = [
    { id: 152063, name: "Death Stranding Director's Cut", first_release_date: unix(2021), platforms: [{ abbreviation: 'PS5' }, { abbreviation: 'PC' }] },
    { id: 114283, name: 'Persona 5 Royal', first_release_date: unix(2019) },
    9, // unexpanded id
  ];
  assertEquals(mapVersions(raw), [{ id: 152063, name: "Death Stranding Director's Cut", year: 2021, platforms: ['PS5', 'PC'] }]);
  assertEquals(versionNames(raw, 'Death Stranding'), ["Director's Cut"]);
  assertEquals(shortVersionName("Ghost of Tsushima: Director's Cut", 'Ghost of Tsushima'), "Director's Cut");
  assertEquals(shortVersionName('Death Stranding', 'Death Stranding'), 'Death Stranding');
  assertEquals(shortVersionName('Kiwami Edition', 'Yakuza'), 'Kiwami Edition');
  assertEquals(versionNames(undefined, 'X'), []);
});
