import { assertEquals } from '@std/assert';

import { normalizeTitle, rankCompanies, rankGames, titleRank } from './ranking.ts';

// Shapes from the live "half-life 2" search, AFTER curation (mods/bundles already removed).
const HL2_CURATED = [
  { id: 10395, name: 'Half-Life 2: Lost Coast', entryType: 'game' as const, total_rating_count: 300 },
  { id: 233, name: 'Half-Life 2', entryType: 'game' as const, total_rating_count: 2500 },
  { id: 1000, name: 'Half-Life 2: Episode Two', entryType: 'expansion' as const, total_rating_count: 900 },
  { id: 1001, name: 'Half-Life 2: Soundtrack', entryType: 'dlc' as const, total_rating_count: 2 },
];

Deno.test('exact title first; games before expansions before DLC; then most-rated', () => {
  const ranked = rankGames(HL2_CURATED, 'half-life 2', 10).map((g) => g.name);
  assertEquals(ranked, ['Half-Life 2', 'Half-Life 2: Lost Coast', 'Half-Life 2: Episode Two', 'Half-Life 2: Soundtrack']);
});

Deno.test('titles normalize punctuation, case and accents', () => {
  assertEquals(normalizeTitle('Half-Life 2: Episode One'), 'half life 2 episode one');
  assertEquals(normalizeTitle('Pokémon Red'), 'pokemon red');
  assertEquals(titleRank('Half-Life 2', 'half life 2'), 0);
  assertEquals(titleRank('Half-Life 2: Lost Coast', 'half-life 2'), 1);
  assertEquals(titleRank('The Legend of Zelda: Breath of the Wild', 'zelda wild'), 2);
  assertEquals(titleRank('Portal', 'half-life'), 3);
});

Deno.test('ranking never drops games (filtering is curation.ts’s job)', () => {
  assertEquals(rankGames([{ name: 'Quake' }, { name: 'Quake II', entryType: 'dlc' as const }], 'quake', 5).length, 2);
});

Deno.test('companies: empty duplicates dropped when a real match exists', () => {
  const ranked = rankCompanies(
    [
      { name: 'Valve Software', developedCount: 0, publishedCount: 0 },
      { name: 'Valve', developedCount: 92, publishedCount: 40 },
      { name: 'Valve Workshop', developedCount: 2, publishedCount: 0 },
    ],
    'valve',
    10,
  ).map((c) => c.name);
  assertEquals(ranked, ['Valve', 'Valve Workshop']);
  // with no real matches, keep what IGDB has
  assertEquals(rankCompanies([{ name: 'Tiny Co', developedCount: 0, publishedCount: 0 }], 'tiny', 5).length, 1);
});
