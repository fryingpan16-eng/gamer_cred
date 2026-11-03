# igdb-proxy

Server-side catalogue search for GamerCred: IGDB (games, studios) and RAWG
(people, PC requirements), with PostgreSQL caching in `igdb_cache`. The app never
calls IGDB or RAWG directly.

Actions: `search` (games / companies / creators), `lookup` (games by id),
`detail` (full game page). See `../_shared/igdb-contract.ts` for the contract.

## Curation: one entry per game

Every IGDB game — from search, lookup, detail or a cache refresh — passes through
`curateGames()` in **`curation.ts`** before it is cached or returned. Games that
fail are never cached or shown. There is no other code path to IGDB games.

A game is kept only if **all** of these hold (overrides aside):

| Rule | Why |
|---|---|
| `version_parent` is null | drops GOTY / Deluxe / Definitive editions |
| `first_release_date` is set | drops unannounced / TBA entries |
| `game_type` maps to an entry type (below) | drops mods, remasters, ports, … |
| it shows a **legitimacy signal** (below) | drops fan games IGDB lists as main games |
| bundles hold ≥ `COLLECTION_MIN_BASE_GAMES` base games **that share a series or a developer** | keeps real collections and developer compilations, drops "Game + Season Pass" and unrelated retail bundles |

| IGDB `game_type` | Result | `entryType` |
|---|---|---|
| main game, expanded game | kept | `game` |
| remake | kept (own entry) | `remake` |
| bundle (passes collection check) | kept, never merged with its games; lists them in `collectionGames` | `collection` |
| expansion, standalone expansion | kept (own category) | `expansion` |
| DLC / add-on | kept (own category) | `dlc` |
| mod (fan games are listed as mods), remaster, episode, season, port, fork, pack, update | **excluded** | — |

`dlc` and `expansion` entries carry `parentGame` so the app can say
"DLC for Elden Ring"; `collection` entries carry `collectionGames` ("Includes
Halo 3, Halo 4 +4 more"). Use `isRankableEntry()` (contract) for any "top
games" list: only `game` and `remake` count. Collections, expansions and DLC get
their own lists (`isCollectionEntry()`, `isAddOnEntry()`).

**Collections.** A bundle is a collection when it holds ≥ 2 distinct base games
(remasters count, de-duplicated by the original) and at least
`COLLECTION_SHARED_RATIO` of them share either

- a **series** (IGDB `collections` / `franchises`) — Halo: MCC, the Nathan Drake
  Collection, The Last of Us Complete; or
- a **developer** — developer compilations such as The Orange Box (Valve) or
  Rare Replay (Rare).

"The Witcher 3 + Dark Souls III" shares neither and is dropped. The games inside
always keep their own entries.

**Verified ids:** `GAME_TYPE` in `curation.ts` mirrors IGDB's `game_types`
endpoint (the replacement for the deprecated `category` enum). It was checked
against live data, and `curation_test.ts` asserts it against
`fixtures/igdb-samples.json`. Refresh the fixture with your Twitch credentials:

```bash
IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node tools/igdb-verify.mjs > /tmp/igdb-samples.json
python3 tools/trim-igdb-samples.py /tmp/igdb-samples.json

# fan-game tuning data
IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node tools/igdb-fangame-probe.mjs > /tmp/igdb-fangame-probe.json
python3 tools/trim-igdb-samples.py --probe /tmp/igdb-fangame-probe.json
```

### Known gaps (handle with overrides)

- **A fan game with a store or GiantBomb listing, or a separate publisher and
  enough ratings,** looks legitimate and passes. Add an `exclude` override.
- **Obscure official entries with no links, ratings or publisher** are dropped.
  Add an `include` override.
- **Collections IGDB has no series/developer data for** are dropped; add an
  `include` override to keep one.

### Fan games (legitimacy signal)

IGDB's only fan-game flag is `mod`, but most fan games (Pokémon Uranium, AM2R,
Sonic P-06…) are listed as **main games**. A game is therefore kept only if it has
at least one of:

1. a **real storefront** listing (`STOREFRONT_SOURCE_IDS`: Steam, GOG, Epic,
   PlayStation Store, Xbox/Microsoft/Game Pass, Apple, Google Play, Amazon,
   Oculus, Utomik). itch.io and Game Jolt are deliberately excluded — that's
   where fan games live — as are YouTube/Twitch/IGDB, which list anything;
2. a **GiantBomb** listing (IGDB has no Nintendo eShop source, so official
   Nintendo and Japan-only games mostly rely on this); or
3. **≥ `MIN_RATING_COUNT` ratings and a publisher that isn't its own developer**.
   Fan games are unpublished or self-published (AM2R: DoctorM64 → DoctorM64),
   while ratings-only official releases (Zelda: Four Swords, the Pokémon Scarlet
   DLCs) have a separate publisher (Capcom → Nintendo, Game Freak → Nintendo).

Measured on live searches for Pokémon, Mario, Zelda, Sonic, Metroid and Final
Fantasy (`fixtures/igdb-fangame-probe.json`): "pokemon" goes from 18 results to
the 4 official games, every fan game in the sample is dropped, and Undertale,
Celeste, Stardew Valley, Hollow Knight, Cave Story, Mother 3 and EarthBound all
survive. The trade-off: a handful of obscure official entries with no links,
ratings or publisher (e.g. the Game & Watch "Zelda") are dropped too — use an
`include` override for any that matter.

### Tunables (`curation.ts`)

- `COLLECTION_MIN_BASE_GAMES` (default `2`) — distinct base games a bundle needs
  to count as a collection.
- `COLLECTION_SHARED_RATIO` (default `0.75`) — share of those games that must
  have a series (or a developer) in common. Below 1 so a few odd credits (e.g.
  Rare's earliest titles credited to Ultimate Play the Game) don't sink a real
  compilation; with 2 games both must match.
- `COLLECTION_CHILD_GAME_TYPES` (default main game, remake, remaster, expanded
  game) — what counts as a base game inside a bundle. Remasters count (the
  Nathan Drake Collection's games are all remasters) but are de-duplicated by
  the original they derive from, so "Halo CE + Halo CE Anniversary" counts once.
- `ENTRY_TYPE_BY_GAME_TYPE` — which game types are kept and how they're labelled.
- `STOREFRONT_SOURCE_IDS` — IGDB `external_game_sources` that count as real stores.
- `MIN_RATING_COUNT` (default `5`) — ratings needed when a game has no store or
  GiantBomb listing (together with a separate publisher).
- `SEARCH_CANDIDATE_LIMIT` (default `200`) — how many IGDB search results to
  fetch before curation. Search queries also pre-filter at IGDB (no editions, a
  release date, only keepable game types; `include` overrides OR-ed back in)
  because for broad terms like "pokemon" IGDB's own ranking puts short-named fan
  games first and official titles only appear deeper in the results.

### Caching & rate limits (`cache_policy.ts`)

- **Rules version.** Every cached IGDB result (searches, game records, game
  pages, collection checks) is stamped with a fingerprint of the curation +
  ranking code and this function's query fields. Deploying a rule change
  expires older entries automatically, so no old answer outlives its rules.
  RAWG data is not stamped, so rule changes never cost RAWG quota (a game page
  refetched only because of a rule change reuses its cached PC requirements).
- **Stale-while-revalidate for searches.** Inside the refresh window a cached
  search is served as-is; after it, the cached result is still served instantly
  while ONE background refresh updates it (`X-Cache: REVALIDATING`). Past the hard
  TTL it's fetched before answering.

  | Search | Refresh after (`SEARCH_REFRESH_AFTER_MS`) | Hard TTL (`CACHE_TTL_MS`) |
  |---|---|---|
  | games (IGDB) | 6 h | 24 h |
  | companies (IGDB) | 3 days | 7 days |
  | creators (RAWG) | never (monthly-capped API) | 14 days |

- **Per-game records** (`game:<v>:igdb:<id>`, 7 days) are what lookups use:
  cached games are served from the cache, only missing ones are fetched, and
  every game search also refreshes the records of the games it returns.
- Collection checks are batched (one IGDB call for every unchecked bundle in a
  request) and cached as `bundle-check:<v>:igdb:<id>` for 30 days.
- Identical concurrent cache misses share one upstream call; all IGDB calls go
  through a limiter: ≤ 4 requests/second, ≤ 8 in flight.
- `CACHE_VERSION` (in the keys) only needs bumping for **shape** changes the
  rules version can't detect, e.g. renaming a field in the cached JSON.

## Overrides

`public.game_overrides` (migration 000013) beats every rule. Only the function
can read it (RLS, no client policies). Changes apply within ~5 minutes.

```sql
-- Always show a game the rules drop (e.g. a remaster you want as its own entry)
insert into public.game_overrides (igdb_id, action, note)
values (6036, 'include', 'The Last of Us Remastered — keep for PS4-era reviews');

-- Never show a game the rules keep
insert into public.game_overrides (igdb_id, action, note)
values (123456, 'exclude', 'Duplicate entry');

-- Remove an override
delete from public.game_overrides where igdb_id = 6036;
```

Excludes apply immediately to cached results too. A new `include` appears in
search once that search's cache entry expires (24 h) or after a cache clear:
`delete from public.igdb_cache where cache_key like 'search:%';`

## Tests

```bash
deno test   # from this directory: curation, ranking and RAWG suites
```
