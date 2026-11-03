// Read-only IGDB probe for tuning the fan-game ("is this a real release?") rules.
// Pulls the legitimacy signals for searches that are full of fan games and for
// genuine games that a too-strict rule could wrongly drop.
//
// Usage (credentials stay in your shell; the output contains no secrets):
//   IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node tools/igdb-fangame-probe.mjs > /tmp/igdb-fangame-probe.json
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
  await sleep(300); // stay under IGDB's 4 requests/second
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
  'id,name,game_type,version_parent,first_release_date,total_rating_count,',
  'involved_companies.developer,involved_companies.publisher,involved_companies.company.name,',
  'external_games.external_game_source,platforms.abbreviation,franchises.name',
].join('');

// Searches crowded with fan games, and genuine games (indie, retro, Japan-only)
// a strict rule could wrongly drop.
const FAN_HEAVY = ['pokemon', 'mario', 'zelda', 'sonic', 'metroid', 'final fantasy'];
const MUST_KEEP = [
  'undertale', 'celeste', 'stardew valley', 'hollow knight', 'cave story', 'yume nikki',
  'mother 3', 'earthbound', 'pokemon red', 'pokemon scarlet', 'super metroid', 'chrono trigger',
];

const out = {
  fetched_at: new Date().toISOString(),
  external_game_sources: await igdb('external_game_sources', 'fields id,name; limit 100; sort id asc;'),
  searches: {},
};
for (const q of [...FAN_HEAVY, ...MUST_KEEP]) {
  const limit = FAN_HEAVY.includes(q) ? 60 : 5;
  out.searches[q] = {
    group: FAN_HEAVY.includes(q) ? 'fan_heavy' : 'must_keep',
    ...(await igdb('games', `search "${q}"; fields ${FIELDS}; where version_parent = null; limit ${limit};`)),
  };
}

console.log(JSON.stringify(out, null, 2));
