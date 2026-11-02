import { assertEquals, assertRejects } from '@std/assert';

import { mapRawgCreators, matchesAllTokens, RawgError, rawgResizedImage, searchRawgCreators } from './rawg.ts';

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
