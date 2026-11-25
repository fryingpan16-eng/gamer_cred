// Read-only IGDB check of the platform → generation table in migration 000051:
// prints every id with IGDB's platform name next to the group we gave it, so a
// wrong id stands out. Credentials stay in your shell; nothing is written.
//   IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node tools/platform-generations-verify.mjs
import { readFileSync } from 'node:fs';

const { IGDB_CLIENT_ID: id, IGDB_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error('Set IGDB_CLIENT_ID and IGDB_CLIENT_SECRET in your shell first.');
  process.exit(1);
}

const sql = readFileSync(new URL('../../../migrations/000051_generations.sql', import.meta.url), 'utf8');
const table = sql.slice(sql.indexOf('insert into public.platform_generations'), sql.indexOf('on conflict (platform_id)'));
const rows = [...table.matchAll(/\((\d+), '([a-z0-9]+)'\)/g)].map((m) => ({ id: Number(m[1]), group: m[2] }));

const tokenRes = await fetch(
  `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
  { method: 'POST' },
);
const { access_token } = await tokenRes.json();
if (!access_token) {
  console.error('Twitch token request failed — check the client id/secret.');
  process.exit(1);
}

const res = await fetch('https://api.igdb.com/v4/platforms', {
  method: 'POST',
  headers: { 'Client-ID': id, Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
  body: `fields id,name,abbreviation,generation; where id = (${rows.map((r) => r.id).join(',')}); limit 500;`,
});
const platforms = new Map((await res.json()).map((p) => [p.id, p]));

for (const r of rows) {
  const p = platforms.get(r.id);
  const name = p ? `${p.name}${p.abbreviation ? ` (${p.abbreviation})` : ''}` : '!! NOT ON IGDB';
  const igdbGen = p?.generation ? `  [IGDB says gen ${p.generation}]` : '';
  console.log(`${String(r.id).padStart(4)}  ${r.group.padEnd(6)}  ${name}${igdbGen}`);
}
