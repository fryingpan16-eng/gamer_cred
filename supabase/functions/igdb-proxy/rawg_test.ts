import { assertEquals, assertRejects } from '@std/assert';

import {
  fetchRawgPcRequirements,
  mapRawgCreators,
  matchesAllTokens,
  parseRequirementText,
  RawgError,
  rawgResizedImage,
  searchRawgCreators,
} from './rawg.ts';

const FIXTURE = [
  {
    id: 1,
    name: 'Hideo Kojima',
    slug: 'hideo-kojima',
    image: 'https://media.rawg.io/media/persons/abc.jpg',
    games_count: 40,
    positions: [{ name: 'director' }, { name: 'writer' }, { name: 'director' }],
    games: [
      { name: 'Metal Gear Solid', added: 10 },
      { name: 'Death Stranding', added: 50 },
      { name: 'Snatcher', added: 1 },
      { name: 'P.T.', added: 5 },
    ],
  },
  { id: 2, name: 'Kojima Productions Staffer', games_count: 2 },
  { id: 3, name: 'Shigeru Miyamoto', games_count: 120 }, // unrelated: must be filtered out
  { id: 4, slug: 'nameless' }, // no name: dropped
  { id: 5, name: 'José Kojima', image: null, games_count: 1 },
];

Deno.test('keeps only name matches and ranks prefix/word matches by catalogue size', () => {
  const results = mapRawgCreators(FIXTURE, 'kojima', 10);
  assertEquals(results.map((r) => r.id), [2, 1, 5]);
});

Deno.test('maps fields, dedupes positions, picks most-added games', () => {
  const [hideo] = mapRawgCreators(FIXTURE, 'hideo kojima', 10);
  assertEquals(hideo?.positions, ['director', 'writer']);
  assertEquals(hideo?.knownFor, ['Death Stranding', 'Metal Gear Solid', 'P.T.']);
  assertEquals(hideo?.imageUrl, 'https://media.rawg.io/media/resize/200/-/persons/abc.jpg');
  assertEquals(hideo?.source, 'rawg');
});

Deno.test('diacritic- and case-insensitive token matching', () => {
  assertEquals(matchesAllTokens('José Kojima', 'jose koj'), true);
  assertEquals(matchesAllTokens('Hideo Kojima', 'hideo miyamoto'), false);
});

Deno.test('image resize leaves foreign / already-resized URLs alone', () => {
  assertEquals(rawgResizedImage(null), null);
  assertEquals(rawgResizedImage('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  const resized = 'https://media.rawg.io/media/resize/200/-/persons/a.jpg';
  assertEquals(rawgResizedImage(resized), resized);
});

Deno.test('sends key, search and page_size; maps HTTP failures', async () => {
  let requested: URL | null = null;
  const ok: typeof fetch = (input) => {
    requested = new URL(input instanceof Request ? input.url : String(input));
    return Promise.resolve(Response.json({ results: FIXTURE }));
  };
  const results = await searchRawgCreators('kojima', 5, 'secret', { fetchImpl: ok });
  assertEquals(results.length, 3);
  assertEquals(requested!.searchParams.get('key'), 'secret');
  assertEquals(requested!.searchParams.get('search'), 'kojima');
  assertEquals(requested!.searchParams.get('page_size'), '20');

  const status = (code: number): typeof fetch => () => Promise.resolve(new Response('{}', { status: code }));
  const e429 = await assertRejects(() => searchRawgCreators('kojima', 5, 'k', { fetchImpl: status(429) }), RawgError);
  assertEquals(e429.status, 429);
  const e401 = await assertRejects(() => searchRawgCreators('kojima', 5, 'k', { fetchImpl: status(401) }), RawgError);
  assertEquals(e401.message, 'RAWG rejected the API key');
});

Deno.test('parses plain-text requirement blobs into label/value rows', () => {
  const rows = parseRequirementText('Minimum:\nOS: Windows 10 64-bit\nProcessor: Intel Core i5-4460\nMemory: 8 GB RAM\nAdditional Notes: SSD required');
  assertEquals(rows, [
    { label: 'OS', value: 'Windows 10 64-bit' },
    { label: 'Processor', value: 'Intel Core i5-4460' },
    { label: 'Memory', value: '8 GB RAM' },
    { label: 'Additional Notes', value: 'SSD required' },
  ]);
});

Deno.test('parses HTML requirement blobs and decodes entities', () => {
  const rows = parseRequirementText('<strong>Minimum:</strong><br><ul><li><strong>OS:</strong> Windows&nbsp;XP</li><li>Graphics: DirectX 9 &amp; 128 MB</li><li>Broadband required</li></ul>');
  assertEquals(rows, [
    { label: 'OS', value: 'Windows XP' },
    { label: 'Graphics', value: 'DirectX 9 & 128 MB' },
    { label: null, value: 'Broadband required' },
  ]);
});

Deno.test('requirements: slug hit with matching name, else exact-name search, else null', async () => {
  const pcGame = (slug: string, name: string) => ({
    id: 42,
    slug,
    name,
    platforms: [{ platform: { slug: 'pc' }, requirements: { minimum: 'OS: Windows 10', recommended: 'OS: Windows 11' } }],
  });
  const routes = (table: Record<string, unknown>): typeof fetch => (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const key = url.pathname.replace('/api', '') + (url.searchParams.get('search') ? `?${url.searchParams.get('search')}` : '');
    return Promise.resolve(key in table ? Response.json(table[key]) : new Response('{}', { status: 404 }));
  };

  const direct = await fetchRawgPcRequirements('half-life-2', 'Half-Life 2', 'k', {
    fetchImpl: routes({ '/games/half-life-2': pcGame('half-life-2', 'Half-Life 2') }),
  });
  assertEquals(direct?.minimum, [{ label: 'OS', value: 'Windows 10' }]);
  assertEquals(direct?.sourceUrl, 'https://rawg.io/games/half-life-2');

  // Slug collides with a different game → fall back to search → exact name only.
  const viaSearch = await fetchRawgPcRequirements('doom', 'DOOM (2016)', 'k', {
    fetchImpl: routes({
      '/games/doom': pcGame('doom', 'DOOM'),
      '/games?DOOM (2016)': { results: [{ id: 7, name: 'DOOM Eternal' }, { id: 42, name: 'Doom (2016)' }] },
      '/games/42': pcGame('doom-2', 'Doom (2016)'),
    }),
  });
  assertEquals(viaSearch?.recommended, [{ label: 'OS', value: 'Windows 11' }]);

  const none = await fetchRawgPcRequirements(null, 'Unknown Game', 'k', {
    fetchImpl: routes({ '/games?Unknown Game': { results: [{ id: 1, name: 'Unknown Game 2' }] } }),
  });
  assertEquals(none, null);
});
