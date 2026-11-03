// Read-only IGDB probe: enum values + sample payloads for the curation filter tests.
// Usage (credentials stay in your shell; the output file contains no secrets):
//   IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node tools/igdb-verify.mjs > /tmp/igdb-samples.json
//   python3 tools/trim-igdb-samples.py /tmp/igdb-samples.json   # → fixtures/igdb-samples.json
const { IGDB_CLIENT_ID: id, IGDB_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error('Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in your shell first.');
  process.exit(1);
}

const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
  { method: 'POST' },
);
const { access_token } = await tokenRes.json();
if (!access_token) {
  console.error('Twitch token request failed — check the client id/secret.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function igdb(endpoint, body) {
  await sleep(300); // stay well under IGDB's 4 req/s
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': id, Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
    body,
  });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    return { status: res.status, body: text };
  }
}

const FIELDS = [
  'id,name,slug,game_type,category,version_parent,parent_game,bundles,first_release_date,total_rating_count,',
  'involved_companies.developer,involved_companies.publisher,involved_companies.company.name,',
  'external_games.category,external_games.external_game_source,external_games.name',
].join('');

const SAMPLES = {
  edition: 'The Witcher 3: Wild Hunt - Game of the Year Edition',
  base_game: 'The Witcher 3: Wild Hunt',
  remaster: 'The Last of Us Remastered',
  original: 'The Last of Us',
  remake: 'Final Fantasy VII Remake',
  collection: 'Halo: The Master Chief Collection',
  collection_2: 'Uncharted: The Nathan Drake Collection',
  edition_bundle: 'Destiny 2: Forsaken',
  mod: 'Half-Life 2: MMod',
  fan_game: 'AM2R',
  developer_compilation: 'The Orange Box',
  developer_compilation_2: 'Rare Replay',
};

const out = {
  fetched_at: new Date().toISOString(),
  game_types: await igdb('game_types', 'fields id,type; limit 50; sort id asc;'),
  external_game_sources: await igdb('external_game_sources', 'fields id,name; limit 100; sort id asc;'),
  samples: {},
  bundle_children: {},
};

for (const [key, name] of Object.entries(SAMPLES)) {
  out.samples[key] = await igdb('games', `search "${name}"; fields ${FIELDS}; limit 5;`);
}

// Children of every bundle-type sample (what the collection check will count).
const bundleIds = new Set();
for (const s of Object.values(out.samples)) {
  for (const g of Array.isArray(s.body) ? s.body : []) {
    if (g.game_type === 3 || g.category === 3) bundleIds.add(g.id);
  }
}
for (const b of bundleIds) {
  out.bundle_children[b] = await igdb(
    'games',
    // v2: series + developer fields for the shared-series / shared-developer rule
    `fields id,name,game_type,version_parent,parent_game,bundles,collections,franchises,involved_companies.developer,involved_companies.company; where bundles = (${b}); limit 50;`,
  );
}

console.log(JSON.stringify(out, null, 2));
