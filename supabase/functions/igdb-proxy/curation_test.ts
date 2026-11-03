import { assertEquals } from '@std/assert';

import probe from './fixtures/igdb-fangame-probe.json' with { type: 'json' };
import live from './fixtures/igdb-samples.json' with { type: 'json' };

import {
  bundlesNeedingCheck,
  classifyGame,
  collectionsFromChildren,
  COLLECTION_MIN_BASE_GAMES,
  curateGames,
  GAME_TYPE,
  parentGameOf,
  searchableGameTypes,
  searchWhereClause,
  type CurationContext,
  type CurationFields,
} from './curation.ts';

// Sample IGDB payloads (fields the filter reads). Release dates are unix seconds.
const D = 1_400_000_000;
/** A storefront listing (Steam) — the legitimacy signal official releases carry. */
const ON_STEAM = { external_games: [{ external_game_source: 1 }] };
const SAMPLES = {
  witcher3: { id: 1942, name: 'The Witcher 3: Wild Hunt', game_type: GAME_TYPE.MAIN_GAME, version_parent: null, first_release_date: D, ...ON_STEAM },
  witcher3Goty: {
    id: 22439,
    name: 'The Witcher 3: Wild Hunt - Game of the Year Edition',
    game_type: GAME_TYPE.MAIN_GAME,
    version_parent: 1942,
    first_release_date: D,
    ...ON_STEAM,
  },
  tlou: { id: 1009, name: 'The Last of Us', game_type: GAME_TYPE.MAIN_GAME, first_release_date: D, ...ON_STEAM },
  tlouRemastered: { id: 6036, name: 'The Last of Us Remastered', game_type: GAME_TYPE.REMASTER, first_release_date: D, ...ON_STEAM },
  ff7Remake: { id: 11169, name: 'Final Fantasy VII Remake', game_type: GAME_TYPE.REMAKE, first_release_date: D, ...ON_STEAM },
  mcc: { id: 7334, name: 'Halo: The Master Chief Collection', game_type: GAME_TYPE.BUNDLE, first_release_date: D, ...ON_STEAM },
  seasonPassBundle: { id: 90001, name: 'Destiny 2: Forsaken + Season Pass', game_type: GAME_TYPE.BUNDLE, first_release_date: D, ...ON_STEAM },
  hl2Mod: { id: 132989, name: 'Half-Life 2: MMod', game_type: GAME_TYPE.MOD, first_release_date: D, ...ON_STEAM },
  fanGame: { id: 16224, name: 'AM2R', game_type: GAME_TYPE.MOD, first_release_date: D, ...ON_STEAM },
  dlc: {
    id: 1100,
    name: 'Cyberpunk 2077: Phantom Liberty',
    game_type: GAME_TYPE.DLC_ADDON,
    parent_game: { id: 1877, name: 'Cyberpunk 2077' },
    first_release_date: D,
    ...ON_STEAM,
  },
  expansion: {
    id: 1200,
    name: 'Elden Ring: Shadow of the Erdtree',
    game_type: GAME_TYPE.EXPANSION,
    parent_game: { id: 119133, name: 'Elden Ring' },
    first_release_date: D,
    ...ON_STEAM,
  },
  standalone: { id: 1300, name: 'Uncharted: The Lost Legacy', game_type: GAME_TYPE.STANDALONE_EXPANSION, first_release_date: D, ...ON_STEAM },
  upcoming: { id: 1400, name: 'Untitled Sequel', game_type: GAME_TYPE.MAIN_GAME, ...ON_STEAM },
} satisfies Record<string, CurationFields>;

// Companies and series used below.
const BUNGIE = { id: 1 };
const STUDIO_343 = { id: 2 };
const VALVE = { id: 3 };
const RARE = { id: 4 };
const ULTIMATE = { id: 5 }; // Rare's predecessor, credited on its earliest games
const HALO_SERIES = 100;
const dev = (...companies: { id: number }[]) => companies.map((company) => ({ developer: true, company }));

// Children returned by `where bundles = (7334, 90001)`.
const BUNDLE_CHILDREN = [
  { id: 740, name: 'Halo: Combat Evolved', game_type: GAME_TYPE.MAIN_GAME, bundles: [7334], collections: [HALO_SERIES], involved_companies: dev(BUNGIE) },
  { id: 986, name: 'Halo 2', game_type: GAME_TYPE.MAIN_GAME, bundles: [7334], collections: [HALO_SERIES], involved_companies: dev(BUNGIE) },
  { id: 987, name: 'Halo 4', game_type: GAME_TYPE.MAIN_GAME, bundles: [7334], collections: [HALO_SERIES], involved_companies: dev(STUDIO_343) },
  // Halo 2 Anniversary is a remaster of Halo 2 → same distinct game as 986
  { id: 7335, name: 'Halo 2: Anniversary', game_type: GAME_TYPE.REMASTER, parent_game: 986, bundles: [7334], collections: [HALO_SERIES] },
  { id: 25076, name: 'Destiny 2', game_type: GAME_TYPE.MAIN_GAME, bundles: [90001], involved_companies: dev(BUNGIE) },
  { id: 25077, name: 'Destiny 2: Forsaken', game_type: GAME_TYPE.EXPANSION, bundles: [90001], involved_companies: dev(BUNGIE) }, // add-on, not a base game
];

const NO_OVERRIDES = new Map<number, 'include' | 'exclude'>();
const ctx = (overrides = NO_OVERRIDES): CurationContext => ({
  overrides,
  collections: collectionsFromChildren([7334, 90001], BUNDLE_CHILDREN),
});

Deno.test('edition (has version_parent) is dropped; the base game is kept', () => {
  assertEquals(classifyGame(SAMPLES.witcher3Goty, ctx()), { keep: false, reason: 'edition' });
  assertEquals(classifyGame(SAMPLES.witcher3, ctx()), { keep: true, entryType: 'game' });
});

Deno.test('remaster is dropped; the original is the entry', () => {
  assertEquals(classifyGame(SAMPLES.tlouRemastered, ctx()), { keep: false, reason: 'excluded_game_type' });
  assertEquals(classifyGame(SAMPLES.tlou, ctx()), { keep: true, entryType: 'game' });
});

Deno.test('remake gets its own entry tagged remake', () => {
  assertEquals(classifyGame(SAMPLES.ff7Remake, ctx()), { keep: true, entryType: 'remake' });
});

Deno.test('real collection (≥2 base games, same series) is kept as a collection', () => {
  assertEquals(classifyGame(SAMPLES.mcc, ctx()), { keep: true, entryType: 'collection' });
  const info = collectionsFromChildren([7334], BUNDLE_CHILDREN).get(7334)!;
  assertEquals(info.basis, 'series'); // Bungie + 343: different developers, one series
  assertEquals(info.games.map((g) => g.name), ['Halo: Combat Evolved', 'Halo 2', 'Halo 4']); // remaster folded into Halo 2
});

Deno.test('developer compilations qualify without a shared series (The Orange Box, Rare Replay)', () => {
  const orangeBox = collectionsFromChildren([1], [
    { id: 233, name: 'Half-Life 2', game_type: GAME_TYPE.MAIN_GAME, bundles: [1], collections: [10], involved_companies: dev(VALVE) },
    { id: 71, name: 'Portal', game_type: GAME_TYPE.MAIN_GAME, bundles: [1], collections: [11], involved_companies: dev(VALVE) },
    { id: 72, name: 'Team Fortress 2', game_type: GAME_TYPE.MAIN_GAME, bundles: [1], collections: [12], involved_companies: dev(VALVE) },
  ]).get(1)!;
  assertEquals([orangeBox.isCollection, orangeBox.basis], [true, 'developer']);

  // 3 of 4 credit Rare (75%): still a compilation even though one early title credits Ultimate.
  const rareReplay = collectionsFromChildren([2], [
    { id: 81, name: 'Banjo-Kazooie', game_type: GAME_TYPE.MAIN_GAME, bundles: [2], collections: [20], involved_companies: dev(RARE) },
    { id: 82, name: 'Perfect Dark', game_type: GAME_TYPE.MAIN_GAME, bundles: [2], collections: [21], involved_companies: dev(RARE) },
    { id: 83, name: 'Battletoads', game_type: GAME_TYPE.MAIN_GAME, bundles: [2], collections: [22], involved_companies: dev(RARE) },
    { id: 84, name: 'Jetpac', game_type: GAME_TYPE.MAIN_GAME, bundles: [2], involved_companies: dev(ULTIMATE) },
  ]).get(2)!;
  assertEquals([rareReplay.isCollection, rareReplay.basis], [true, 'developer']);
});

Deno.test('retail bundles of unrelated games are dropped (no shared series or developer)', () => {
  const info = collectionsFromChildren([141472], [
    { id: 1942, name: 'The Witcher 3: Wild Hunt', game_type: GAME_TYPE.MAIN_GAME, bundles: [141472], collections: [30], involved_companies: dev({ id: 6 }) },
    { id: 11133, name: 'Dark Souls III', game_type: GAME_TYPE.MAIN_GAME, bundles: [141472], collections: [31], involved_companies: dev({ id: 7 }) },
  ]).get(141472)!;
  assertEquals([info.isCollection, info.basis], [false, null]);
  assertEquals(
    classifyGame({ id: 141472, game_type: GAME_TYPE.BUNDLE, first_release_date: D, ...ON_STEAM }, {
      overrides: NO_OVERRIDES,
      collections: new Map([[141472, info]]),
    }),
    { keep: false, reason: 'edition_bundle' },
  );
});

Deno.test('edition bundle (1 base game + add-ons) is dropped', () => {
  assertEquals(classifyGame(SAMPLES.seasonPassBundle, ctx()), { keep: false, reason: 'edition_bundle' });
});

Deno.test('mods and fan games (listed as mods) are dropped', () => {
  assertEquals(classifyGame(SAMPLES.hl2Mod, ctx()), { keep: false, reason: 'excluded_game_type' });
  assertEquals(classifyGame(SAMPLES.fanGame, ctx()), { keep: false, reason: 'excluded_game_type' });
});

Deno.test('DLC and expansions get their own categories, with their parent game', () => {
  assertEquals(classifyGame(SAMPLES.dlc, ctx()), { keep: true, entryType: 'dlc' });
  assertEquals(classifyGame(SAMPLES.expansion, ctx()), { keep: true, entryType: 'expansion' });
  assertEquals(classifyGame(SAMPLES.standalone, ctx()), { keep: true, entryType: 'expansion' });
  assertEquals(parentGameOf(SAMPLES.dlc), { id: 1877, name: 'Cyberpunk 2077' });
  assertEquals(parentGameOf(SAMPLES.witcher3), null);
  assertEquals(parentGameOf({ id: 1, parent_game: 55 }), null); // unexpanded id only
});

Deno.test('episodes, seasons, ports, forks, packs and updates are dropped', () => {
  for (const game_type of [GAME_TYPE.EPISODE, GAME_TYPE.SEASON, GAME_TYPE.PORT, GAME_TYPE.FORK, GAME_TYPE.PACK, GAME_TYPE.UPDATE]) {
    assertEquals(classifyGame({ id: 9, game_type, first_release_date: D, ...ON_STEAM }, ctx()), {
      keep: false,
      reason: 'excluded_game_type',
    });
  }
});

Deno.test('fan games listed as main games are dropped: no store, no GiantBomb, self- or unpublished', () => {
  const am2r = {
    id: 27238,
    name: 'AM2R: Return of Samus',
    game_type: GAME_TYPE.MAIN_GAME,
    first_release_date: D,
    total_rating_count: 59, // well-rated, but self-published
    external_games: [{ external_game_source: 14 }], // Twitch only
    involved_companies: [{ developer: true, publisher: true, company: { id: 9001 } }],
  };
  assertEquals(classifyGame(am2r, ctx()), { keep: false, reason: 'likely_fan_game' });
  // itch.io / Game Jolt don't count as storefronts
  assertEquals(classifyGame({ id: 2, first_release_date: D, external_games: [{ external_game_source: 30 }, { external_game_source: 55 }] }, ctx()), {
    keep: false,
    reason: 'likely_fan_game',
  });
});

Deno.test('legitimacy: store, GiantBomb, or ratings with a separate publisher', () => {
  const base = { id: 3, game_type: GAME_TYPE.MAIN_GAME, first_release_date: D };
  assertEquals(classifyGame({ ...base, external_games: [{ external_game_source: 36 }] }, ctx()).keep, true); // PS Store
  assertEquals(classifyGame({ ...base, external_games: [{ external_game_source: 3 }] }, ctx()).keep, true); // GiantBomb
  // Teal Mask–style: no links, but rated and published by someone else (Game Freak → Nintendo)
  const published = { ...base, total_rating_count: 12, involved_companies: [
    { developer: true, company: { id: 1 } },
    { publisher: true, company: { id: 2 } },
  ] };
  assertEquals(classifyGame(published, ctx()).keep, true);
  assertEquals(classifyGame({ ...published, total_rating_count: 4 }, ctx()).keep, false); // below MIN_RATING_COUNT
});

Deno.test('a first_release_date is required', () => {
  assertEquals(classifyGame(SAMPLES.upcoming, ctx()), { keep: false, reason: 'no_release_date' });
});

Deno.test('missing game_type is treated as a main game', () => {
  assertEquals(classifyGame({ id: 10, first_release_date: D, ...ON_STEAM }, ctx()), { keep: true, entryType: 'game' });
});

Deno.test('overrides always win over the rules', () => {
  const overrides = new Map<number, 'include' | 'exclude'>([
    [SAMPLES.tlouRemastered.id, 'include'],
    [SAMPLES.upcoming.id, 'include'],
    [SAMPLES.witcher3.id, 'exclude'],
    [SAMPLES.seasonPassBundle.id, 'include'],
  ]);
  assertEquals(classifyGame(SAMPLES.tlouRemastered, ctx(overrides)), { keep: true, entryType: 'game' });
  assertEquals(classifyGame(SAMPLES.upcoming, ctx(overrides)), { keep: true, entryType: 'game' });
  assertEquals(classifyGame(SAMPLES.witcher3, ctx(overrides)), { keep: false, reason: 'override_exclude' });
  assertEquals(classifyGame(SAMPLES.seasonPassBundle, ctx(overrides)), { keep: true, entryType: 'collection' });
});

Deno.test('collection check counts distinct base games only', () => {
  const result = collectionsFromChildren([7334, 90001, 5], [
    ...BUNDLE_CHILDREN,
    { id: 740, game_type: GAME_TYPE.MAIN_GAME, bundles: [7334] }, // duplicate row
    { id: 41, game_type: GAME_TYPE.MAIN_GAME, version_parent: 740, bundles: [5] }, // an edition — not a base game
    { id: 42, game_type: GAME_TYPE.REMAKE, bundles: [5] },
  ]);
  assertEquals(result.get(7334)?.isCollection, true);
  assertEquals(result.get(90001)?.isCollection, false);
  assertEquals(result.get(5)?.isCollection, false); // only one base game (the remake)
  assertEquals(COLLECTION_MIN_BASE_GAMES, 2);
});

Deno.test('eligible bundles need a check; excluded ones don\'t, included ones do (to list contents)', () => {
  const games = [SAMPLES.mcc, SAMPLES.mcc, SAMPLES.seasonPassBundle, SAMPLES.witcher3, { ...SAMPLES.mcc, id: 77, version_parent: 7334 }];
  assertEquals(bundlesNeedingCheck(games, { overrides: NO_OVERRIDES }), [7334, 90001]);
  assertEquals(bundlesNeedingCheck(games, { overrides: new Map([[90001, 'exclude' as const]]) }), [7334]);
  assertEquals(bundlesNeedingCheck(games, { overrides: new Map([[90001, 'include' as const]]) }), [7334, 90001]);
});

Deno.test('curateGames: one collection check per batch, order kept, drops reported', async () => {
  let checks = 0;
  const { kept, dropped } = await curateGames(Object.values(SAMPLES), {
    getOverrides: () => Promise.resolve(NO_OVERRIDES),
    checkCollections: (ids) => {
      checks++;
      return Promise.resolve(collectionsFromChildren(ids, BUNDLE_CHILDREN));
    },
  });
  assertEquals(checks, 1);
  assertEquals(
    kept.map((g) => [g.name, g.entryType]),
    [
      ['The Witcher 3: Wild Hunt', 'game'],
      ['The Last of Us', 'game'],
      ['Final Fantasy VII Remake', 'remake'],
      ['Halo: The Master Chief Collection', 'collection'],
      ['Cyberpunk 2077: Phantom Liberty', 'dlc'],
      ['Elden Ring: Shadow of the Erdtree', 'expansion'],
      ['Uncharted: The Lost Legacy', 'expansion'],
    ],
  );
  assertEquals(dropped.length, 6);
  assertEquals(kept.find((g) => g.entryType === 'collection')?.collectionGames.length, 3);
  assertEquals(kept.find((g) => g.entryType === 'game')?.collectionGames, []);
});

Deno.test('curateGames skips the collection check when there are no bundles', async () => {
  let checks = 0;
  await curateGames([SAMPLES.witcher3], {
    getOverrides: () => Promise.resolve(NO_OVERRIDES),
    checkCollections: () => {
      checks++;
      return Promise.resolve(new Map());
    },
  });
  assertEquals(checks, 0);
});

// -----------------------------------------------------------------------------
// Live IGDB payloads (fixtures/igdb-samples.json, captured with igdb-verify.mjs)
// -----------------------------------------------------------------------------

Deno.test('GAME_TYPE matches the live IGDB game_types endpoint', () => {
  const byId = new Map(live.game_types.map((t) => [t.id, t.type]));
  const expected: Record<keyof typeof GAME_TYPE, string> = {
    MAIN_GAME: 'Main Game',
    DLC_ADDON: 'DLC',
    EXPANSION: 'Expansion',
    BUNDLE: 'Bundle',
    STANDALONE_EXPANSION: 'Standalone Expansion',
    MOD: 'Mod',
    EPISODE: 'Episode',
    SEASON: 'Season',
    REMAKE: 'Remake',
    REMASTER: 'Remaster',
    EXPANDED_GAME: 'Expanded Game',
    PORT: 'Port',
    FORK: 'Fork',
    PACK: 'Pack / Addon',
    UPDATE: 'Update',
  };
  for (const [key, label] of Object.entries(expected)) {
    assertEquals(byId.get(GAME_TYPE[key as keyof typeof GAME_TYPE]), label, key);
  }
});

Deno.test('live payloads: one entry per game', () => {
  const collections = collectionsFromChildren(live.bundle_ids, live.bundle_children);
  const decide = (id: number) => {
    const game = live.games.find((g) => g.id === id);
    if (!game) throw new Error(`fixture is missing game ${id}`);
    const d = classifyGame(game as CurationFields, { overrides: NO_OVERRIDES, collections });
    return d.keep ? d.entryType : `drop:${d.reason}`;
  };
  const expected: Record<number, string> = {
    // Editions → the base game is the entry
    22439: 'drop:edition', // The Witcher 3 GOTY Edition
    1942: 'game', // The Witcher 3: Wild Hunt
    89931: 'drop:edition', // The Last of Us Remastered: Day 1 Edition
    41608: 'drop:edition', // Halo: MCC – Limited Edition
    89929: 'drop:edition', // Nathan Drake Collection – Special Edition
    118535: 'drop:edition', // Destiny 2: Forsaken – Complete Collection
    // Remasters excluded; the original stays
    6036: 'drop:excluded_game_type', // The Last of Us Remastered
    415005: 'drop:excluded_game_type', // The Witcher 3 Remastered
    1009: 'game', // The Last of Us
    // Remakes get their own entry
    204350: 'remake', // The Last of Us Part I
    11169: 'remake', // Final Fantasy VII Remake
    // Edition bundles (one base game + add-ons)
    144024: 'drop:edition_bundle', // FF7 Remake Intergrade
    // DLC / expansions: own categories
    144037: 'dlc', // FF7 Remake: Episode Intermission
    103204: 'expansion', // Destiny 2: Forsaken
    // Seasons, mods
    205049: 'drop:excluded_game_type', // MCC Season 2
    129889: 'drop:excluded_game_type', // Forsaken – Season of the Forge
    132989: 'drop:excluded_game_type', // Half-Life 2: MMod
    // Fan games IGDB lists as main games
    27238: 'drop:likely_fan_game', // AM2R: self-published, Twitch-only links
  };
  for (const [id, outcome] of Object.entries(expected)) assertEquals(decide(Number(id)), outcome, `game ${id}`);
});

// Needs bundle children with series + developer fields (igdb-verify.mjs v2). Older
// fixtures lack them, so this runs only once the fixture has been refreshed.
const fixtureHasSeries = live.bundle_children.some((c) => 'collections' in c || 'involved_companies' in c);
Deno.test({
  name: 'live payloads: collections need a shared series or developer',
  ignore: !fixtureHasSeries,
  fn: () => {
    const collections = collectionsFromChildren(live.bundle_ids, live.bundle_children as never);
    const isCollection = (id: number) => collections.get(id)?.isCollection;
    assertEquals(isCollection(7348), true); // Halo: The Master Chief Collection — series
    assertEquals(isCollection(10962), true); // Uncharted: The Nathan Drake Collection — series
    assertEquals(isCollection(340213), true); // The Last of Us Complete — series
    assertEquals(isCollection(141472), false); // The Witcher 3 + Dark Souls III — unrelated
    // Developer compilations (no shared series): looked up by name, asserted when present.
    for (const name of ['The Orange Box', 'Rare Replay']) {
      const bundle = live.games.find((g) => g.name === name && live.bundle_ids.includes(g.id));
      if (bundle) assertEquals(isCollection(bundle.id), true, name);
    }
  },
});

// -----------------------------------------------------------------------------
// Fan-game filter on live searches (fixtures/igdb-fangame-probe.json)
// -----------------------------------------------------------------------------

// The JSON's inferred type is a huge union; treat each search as a list of IGDB games.
const probeSearches = probe.searches as unknown as Record<string, { group: string; games: CurationFields[] }>;
const probeGames: CurationFields[] = Object.values(probeSearches).flatMap((s) => s.games);
const probeDecision = (name: string, year?: number) => {
  const game = probeGames.find(
    (g) => g.name === name && (year === undefined || new Date((g.first_release_date ?? 0) * 1000).getUTCFullYear() === year),
  );
  if (!game) throw new Error(`probe fixture is missing "${name}"${year ? ` (${year})` : ''}`);
  const d = classifyGame(game, { overrides: NO_OVERRIDES, collections: new Map() });
  return d.keep ? 'keep' : d.reason;
};

Deno.test('live fan-game probe: official games survive', () => {
  for (const [name, year] of [
    ['Pokémon White Version 2'], ['Pokémon Stadium 2'], ['Pokémon Trozei!'], ['Pokémon Rumble'],
    ['The Legend of Zelda', 1986], ['Zelda: The Wand of Gamelon'], ['The Legend of Zelda: Four Swords'],
    ['Super Metroid'], ['Metroid Dread'], ['Metroid Prime 4: Beyond'],
    ['Super Mario Bros. Wonder'], ['Paper Mario'], ['Sonic Generations'], ['Final Fantasy IX'],
    ['Pokémon Scarlet: The Hidden Treasure of Area Zero - Part 1: The Teal Mask'],
    ['Undertale'], ['Celeste'], ['Stardew Valley'], ['Hollow Knight'], ['Cave Story', 2004], ['Cave Story+'],
    ['Mother 3'], ['EarthBound'],
    // (Chrono Trigger: the probe's top-5 results held only the remaster/port/extras, not the 1995 original.)
  ] as [string, number?][]) {
    // Cave Story 2004 has two records (Studio Pixel's and a fan duplicate): any survivor counts.
    const matches = probeGames.filter((g) => g.name === name && (year === undefined || new Date((g.first_release_date ?? 0) * 1000).getUTCFullYear() === year));
    const kept = matches.some((g) => classifyGame(g, { overrides: NO_OVERRIDES, collections: new Map() }).keep);
    assertEquals(kept, true, `${name}${year ? ` (${year})` : ''} should be kept`);
  }
});

Deno.test('live fan-game probe: fan games are dropped', () => {
  for (const name of [
    'Pokemon Bois', 'Pokemon Kaisen', 'Pokemon Reloaded', 'Pokemon Daycare', 'Pokemon GSC Card Flip',
    'Zelda Mobile', 'The Legend of Zelda: Trident of Power', 'Mini-Metroid', 'Metroid Planets',
    'Sonic P-06', 'Sonic Robo Blast', 'Neo Sonic 3', 'NSMB: Mario vs. Luigi Online',
  ]) {
    assertEquals(probeDecision(name), 'likely_fan_game', name);
  }
});

Deno.test('live fan-game probe: the Pokémon flood is gone', () => {
  const pokemon = probeSearches.pokemon!.games;
  const kept = pokemon.filter((g) => classifyGame(g, { overrides: NO_OVERRIDES, collections: new Map() }).keep).map((g) => g.name);
  assertEquals(kept.sort(), ['Pokémon Rumble', 'Pokémon Stadium 2', 'Pokémon Trozei!', 'Pokémon White Version 2']);
});

Deno.test('search pre-filter: excluded types, editions and undated entries never reach the limit', () => {
  assertEquals(
    searchWhereClause(NO_OVERRIDES),
    '(version_parent = null & first_release_date != null & game_type = (0,1,2,3,4,8,10))',
  );
  // include overrides are OR-ed back in, so the pre-filter can't hide them
  const overrides = new Map<number, 'include' | 'exclude'>([[6036, 'include'], [1, 'exclude']]);
  assertEquals(searchWhereClause(overrides).endsWith(' | id = (6036)'), true);
});

Deno.test('search pre-filter would have removed 36 of the 54 live "pokemon" results', () => {
  const types = new Set(searchableGameTypes());
  const survivors = probeSearches.pokemon!.games.filter(
    (g) => (g.version_parent ?? null) === null && typeof g.first_release_date === 'number' && types.has(g.game_type ?? 0),
  );
  assertEquals([probeSearches.pokemon!.games.length, survivors.length], [54, 18]);
});
