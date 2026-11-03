/**
 * Curation filter — ONE entry per game.
 *
 * Everything here (exported, including helpers) feeds the cache rules version in
 * index.ts: changing any rule automatically invalidates cached IGDB results.
 *
 * Every IGDB game the proxy returns (search, lookup by id, game detail, cache
 * refresh) passes through `curateGames()` before it is cached or shown. Games
 * that fail are never cached or returned. Rules (see README.md):
 *
 *   1. version_parent must be null           → drops GOTY / Deluxe / Definitive editions
 *   2. must have a first_release_date
 *   3. game_type decides the entry:
 *        main game, expanded game  → 'game'
 *        remake                    → 'remake'   (own entry, e.g. FF7 Remake)
 *        expansion, standalone exp → 'expansion' (own category, not in top lists)
 *        DLC                       → 'dlc'       (own category, not in top lists)
 *        bundle                    → 'collection' only if it holds ≥ 2 distinct base games
 *                                    that share a series, or a developer (developer compilations)
 *        mod (= fan games), remaster, episode, season, port, fork, pack, update → excluded
 *   4. legitimacy (fan-game filter): a real storefront listing, a GiantBomb
 *      listing, or ≥ MIN_RATING_COUNT ratings AND a publisher that isn't its own
 *      developer. Fan games are self-published or unpublished, with no store links.
 *   5. game_overrides always win (include / exclude by IGDB id).
 *
 * The collection check and overrides are injected so this module stays pure
 * and unit-testable; index.ts wires them to IGDB and the database.
 */
import type { EntryType } from '../_shared/igdb-contract.ts';

/**
 * IGDB `game_types` ids (the replacement for the deprecated `category` enum).
 * VERIFY against GET /v4/game_types (`fields id,type;`) before relying on them;
 * the curation tests assert this table against captured live data when present.
 */
export const GAME_TYPE = {
  MAIN_GAME: 0,
  DLC_ADDON: 1,
  EXPANSION: 2,
  BUNDLE: 3,
  STANDALONE_EXPANSION: 4,
  MOD: 5,
  EPISODE: 6,
  SEASON: 7,
  REMAKE: 8,
  REMASTER: 9,
  EXPANDED_GAME: 10,
  PORT: 11,
  FORK: 12,
  PACK: 13,
  UPDATE: 14,
} as const;

/** Entry type for each kept game type. Anything not listed (or a failing bundle) is excluded. */
export const ENTRY_TYPE_BY_GAME_TYPE: Readonly<Partial<Record<number, EntryType>>> = {
  [GAME_TYPE.MAIN_GAME]: 'game',
  [GAME_TYPE.EXPANDED_GAME]: 'game',
  [GAME_TYPE.REMAKE]: 'remake',
  [GAME_TYPE.EXPANSION]: 'expansion',
  [GAME_TYPE.STANDALONE_EXPANSION]: 'expansion',
  [GAME_TYPE.DLC_ADDON]: 'dlc',
};

/**
 * Server-side pre-filter for IGDB `search` queries. IGDB ranks a broad term
 * ("pokemon") by title closeness, so short-named fan games and ROM hacks crowd
 * out official titles before any limit applies. Excluding everything curation
 * would drop anyway (editions, undated entries, excluded game types) inside the
 * IGDB query lets real games fill the candidate pool. Overrides marked `include`
 * are OR-ed back in so the pre-filter can never hide them.
 */
export const SEARCH_CANDIDATE_LIMIT = 200;

/** Game types worth fetching in search: everything that can become an entry (bundles may be collections). */
export function searchableGameTypes(): number[] {
  return [...new Set([...Object.keys(ENTRY_TYPE_BY_GAME_TYPE).map(Number), GAME_TYPE.BUNDLE])].sort((a, b) => a - b);
}

/** Apicalypse `where` clause for search (without the leading `where` / trailing `;`). */
export function searchWhereClause(overrides: ReadonlyMap<number, OverrideAction>): string {
  const base = `(version_parent = null & first_release_date != null & game_type = (${searchableGameTypes().join(',')}))`;
  const included = [...overrides].filter(([, action]) => action === 'include').map(([id]) => id);
  return included.length > 0 ? `${base} | id = (${included.slice(0, 500).join(',')})` : base;
}

/** A bundle is a real collection when it contains at least this many distinct base games. */
export const COLLECTION_MIN_BASE_GAMES = 2;

/**
 * Game types that count as a "base game" inside a bundle. Remasters and expanded
 * games count too (the Nathan Drake Collection's games are all remasters), but
 * they're de-duplicated by the original they derive from (see collectionsFromChildren).
 */
export const COLLECTION_CHILD_GAME_TYPES: readonly number[] = [
  GAME_TYPE.MAIN_GAME,
  GAME_TYPE.REMAKE,
  GAME_TYPE.REMASTER,
  GAME_TYPE.EXPANDED_GAME,
];

/** Child game types identified by the original they derive from when counting distinct games. */
export const DERIVED_CHILD_GAME_TYPES: readonly number[] = [GAME_TYPE.REMAKE, GAME_TYPE.REMASTER, GAME_TYPE.EXPANDED_GAME];

/**
 * A collection's base games must have something in common. Either at least this
 * share of them are in one series (IGDB collection/franchise: Halo, Uncharted…),
 * or at least this share have one developer in common, which covers developer
 * compilations like The Orange Box (Valve) or Rare Replay (Rare). Below 1 so a
 * few odd records (e.g. early titles credited to Rare's predecessor) don't break
 * a real compilation. With 2 games, both must match.
 */
export const COLLECTION_SHARED_RATIO = 0.75;

/** Fields to request for bundle children. */
export const COLLECTION_CHILD_FIELDS =
  'name,bundles,game_type,version_parent,parent_game,collections,franchises,involved_companies.developer,involved_companies.company';

/** What a collection check found for one bundle. */
export type CollectionInfo = {
  isCollection: boolean;
  /** Why it qualified, or null when it didn't. */
  basis: 'series' | 'developer' | null;
  /** Distinct base games inside (one per original title), for the "Includes …" marker. */
  games: { id: number; name: string }[];
};

// -----------------------------------------------------------------------------
// Legitimacy (fan-game filter)
// -----------------------------------------------------------------------------
// Tuned on live IGDB searches for Pokémon, Mario, Zelda, Sonic, Metroid and Final
// Fantasy (fixtures/igdb-fangame-probe.json): fan games had no store or GiantBomb
// listing and were unpublished or self-published, while every official title had
// a store/GiantBomb listing or a separate publisher. Only `mod` is IGDB's own
// fan-game flag; most fan games are listed as main games.

/**
 * IGDB `external_game_sources` that are real storefronts. Deliberately absent:
 * itch.io (30) and Game Jolt (55), where fan games live; YouTube (10), Twitch
 * (14) and IGDB (121), which list anything. IGDB has no Nintendo eShop source.
 */
export const STOREFRONT_SOURCE_IDS: ReadonlySet<number> = new Set([
  1, // Steam
  5, // GOG
  11, // Microsoft
  13, // Apple
  15, // Android (Google Play)
  20, // Amazon
  22, // Amazon Luna
  23, // Amazon ADG
  26, // Epic Games Store
  28, // Oculus
  29, // Utomik
  31, // Xbox Marketplace
  36, // PlayStation Store US
  54, // Xbox Game Pass Ultimate Cloud
]);

/** GiantBomb is a curated wiki; official releases (incl. Nintendo, Japan-only) are nearly always on it. */
export const GIANTBOMB_SOURCE_ID = 3;

/** With no store or GiantBomb listing, a game needs this many IGDB ratings AND a separate publisher. */
export const MIN_RATING_COUNT = 5;

/** IGDB fields the filter needs; append to every games query (no other duplicates of these). */
export const CURATION_FIELDS = [
  'game_type,version_parent,first_release_date,parent_game.name,total_rating_count',
  'external_games.external_game_source',
  'involved_companies.developer,involved_companies.publisher,involved_companies.company.name',
].join(',');

export type CurationFields = {
  id: number;
  name?: string;
  /** Absent on some older IGDB records; treated as a main game. */
  game_type?: number;
  version_parent?: number | null;
  first_release_date?: number;
  parent_game?: { id: number; name?: string } | number | null;
  total_rating_count?: number;
  external_games?: { external_game_source?: number }[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { id: number; name?: string } | number }[];
};

export type OverrideAction = 'include' | 'exclude';

export type DropReason =
  | 'override_exclude'
  | 'edition'
  | 'no_release_date'
  | 'excluded_game_type'
  | 'edition_bundle'
  | 'likely_fan_game';

export type CurationDecision = { keep: true; entryType: EntryType } | { keep: false; reason: DropReason };

export type CurationContext = {
  overrides: ReadonlyMap<number, OverrideAction>;
  /** bundle id → is a real collection (≥ COLLECTION_MIN_BASE_GAMES base games). */
  collections: ReadonlyMap<number, CollectionInfo>;
};

export function gameTypeOf(game: CurationFields): number {
  return game.game_type ?? GAME_TYPE.MAIN_GAME;
}

export const companyKey = (c: { id: number } | number | undefined) => (typeof c === 'number' ? c : c?.id);

/**
 * "Is this a real release?" — store listing, GiantBomb listing, or enough
 * ratings plus a publisher that isn't its own developer (fan games are
 * unpublished or self-published: "AM2R" by DoctorM64, "Sonic P-06" by ChaosX).
 */
export function hasLegitimacySignal(game: CurationFields): boolean {
  const sources = new Set((game.external_games ?? []).map((e) => e.external_game_source));
  if ([...sources].some((s) => s !== undefined && STOREFRONT_SOURCE_IDS.has(s))) return true;
  if (sources.has(GIANTBOMB_SOURCE_ID)) return true;
  const companies = game.involved_companies ?? [];
  const developers = new Set(companies.filter((c) => c.developer).map((c) => companyKey(c.company)));
  const separatePublisher = companies.some((c) => c.publisher && !developers.has(companyKey(c.company)));
  return (game.total_rating_count ?? 0) >= MIN_RATING_COUNT && separatePublisher;
}

/** Decide one game. Pure; bundles must already have an entry in `ctx.collections`. */
export function classifyGame(game: CurationFields, ctx: CurationContext): CurationDecision {
  const override = ctx.overrides.get(game.id);
  const type = gameTypeOf(game);

  if (override === 'exclude') return { keep: false, reason: 'override_exclude' };
  if (override === 'include') {
    // An included bundle is a collection; otherwise use the mapped type or fall back to 'game'.
    return { keep: true, entryType: type === GAME_TYPE.BUNDLE ? 'collection' : (ENTRY_TYPE_BY_GAME_TYPE[type] ?? 'game') };
  }

  if (game.version_parent !== undefined && game.version_parent !== null) return { keep: false, reason: 'edition' };
  if (typeof game.first_release_date !== 'number') return { keep: false, reason: 'no_release_date' };

  // Most specific reason first: what kind of entry is it?
  let entryType: EntryType | undefined;
  if (type === GAME_TYPE.BUNDLE) {
    if (ctx.collections.get(game.id)?.isCollection !== true) return { keep: false, reason: 'edition_bundle' };
    entryType = 'collection';
  } else {
    entryType = ENTRY_TYPE_BY_GAME_TYPE[type];
    if (!entryType) return { keep: false, reason: 'excluded_game_type' };
  }

  // Then: is it a real release (not a fan game)?
  if (!hasLegitimacySignal(game)) return { keep: false, reason: 'likely_fan_game' };
  return { keep: true, entryType };
}

/** Bundles whose collection status is needed to classify `games`. */
export function bundlesNeedingCheck(games: readonly CurationFields[], ctx: Pick<CurationContext, 'overrides'>): number[] {
  return [
    ...new Set(
      games
        .filter(
          (g) =>
            gameTypeOf(g) === GAME_TYPE.BUNDLE &&
            // Included bundles are still checked so their contents can be listed.
            ctx.overrides.get(g.id) !== 'exclude' &&
            (g.version_parent === undefined || g.version_parent === null) &&
            typeof g.first_release_date === 'number',
        )
        .map((g) => g.id),
    ),
  ];
}

export type BundleChild = {
  id: number;
  name?: string;
  bundles?: number[];
  game_type?: number;
  version_parent?: number | null;
  parent_game?: { id: number } | number | null;
  /** IGDB series ids. */
  collections?: number[];
  franchises?: number[];
  involved_companies?: { developer?: boolean; company?: { id: number } | number }[];
};

/** The distinct game a bundle child represents: remasters/remakes count as their original. */
export function rootGameId(child: BundleChild): number {
  if (!DERIVED_CHILD_GAME_TYPES.includes(gameTypeOf(child))) return child.id;
  const parent = child.parent_game;
  if (typeof parent === 'number') return parent;
  return parent?.id ?? child.id;
}

/** True when some key appears in at least COLLECTION_SHARED_RATIO of the sets (and in ≥ 2 of them). */
export function shareAKey(sets: readonly ReadonlySet<string>[]): boolean {
  const needed = Math.max(2, Math.ceil(sets.length * COLLECTION_SHARED_RATIO));
  const counts = new Map<string, number>();
  for (const set of sets) for (const key of set) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.values()].some((n) => n >= needed);
}

export function seriesKeys(child: BundleChild): Set<string> {
  return new Set([...(child.collections ?? []).map((id) => `c${id}`), ...(child.franchises ?? []).map((id) => `f${id}`)]);
}

export function developerKeys(child: BundleChild): Set<string> {
  return new Set(
    (child.involved_companies ?? [])
      .filter((ic) => ic.developer)
      .map((ic) => (typeof ic.company === 'number' ? ic.company : ic.company?.id))
      .filter((id): id is number => typeof id === 'number')
      .map(String),
  );
}

/**
 * Decides which bundles are real collections from a `where bundles = (…)` child
 * query: ≥ COLLECTION_MIN_BASE_GAMES distinct base games that share a series or
 * a developer (see COLLECTION_SHARED_RATIO).
 */
export function collectionsFromChildren(
  bundleIds: readonly number[],
  children: readonly BundleChild[],
): Map<number, CollectionInfo> {
  // bundle → root game id → merged facts for that distinct game
  const perBundle = new Map<number, Map<number, { name: string; series: Set<string>; developers: Set<string> }>>(
    bundleIds.map((id) => [id, new Map()]),
  );
  for (const child of children) {
    const isBase =
      (child.version_parent === undefined || child.version_parent === null) &&
      COLLECTION_CHILD_GAME_TYPES.includes(gameTypeOf(child));
    if (!isBase) continue;
    const root = rootGameId(child);
    for (const bundleId of child.bundles ?? []) {
      const games = perBundle.get(bundleId);
      if (!games) continue;
      const entry = games.get(root) ?? { name: child.name ?? `Game #${child.id}`, series: new Set(), developers: new Set() };
      for (const k of seriesKeys(child)) entry.series.add(k);
      for (const k of developerKeys(child)) entry.developers.add(k);
      games.set(root, entry);
    }
  }

  return new Map(
    [...perBundle].map(([bundleId, games]) => {
      const list = [...games.values()];
      const enough = list.length >= COLLECTION_MIN_BASE_GAMES;
      const basis = !enough
        ? null
        : shareAKey(list.map((g) => g.series))
          ? ('series' as const)
          : shareAKey(list.map((g) => g.developers))
            ? ('developer' as const)
            : null;
      return [
        bundleId,
        { isCollection: basis !== null, basis, games: [...games].map(([id, g]) => ({ id, name: g.name })) },
      ];
    }),
  );
}

export type CurationDeps = {
  /** Current overrides (index.ts caches them briefly). */
  getOverrides: () => Promise<ReadonlyMap<number, OverrideAction>>;
  /** Collection status for the given bundle ids (index.ts caches results in igdb_cache). */
  checkCollections: (bundleIds: number[]) => Promise<ReadonlyMap<number, CollectionInfo>>;
};

export type CuratedGame<T> = T & {
  entryType: EntryType;
  /** Base games inside a collection (empty for every other entry type). */
  collectionGames: { id: number; name: string }[];
};

/**
 * The single entry point: classify a batch of raw IGDB games. Resolves overrides
 * and all needed collection checks once per batch (one IGDB call for every
 * unchecked bundle), keeps input order.
 */
export async function curateGames<T extends CurationFields>(
  raw: readonly T[],
  deps: CurationDeps,
): Promise<{ kept: CuratedGame<T>[]; dropped: { id: number; reason: DropReason }[] }> {
  const overrides = await deps.getOverrides();
  const needed = bundlesNeedingCheck(raw, { overrides });
  const collections = needed.length > 0 ? await deps.checkCollections(needed) : new Map<number, CollectionInfo>();

  const kept: CuratedGame<T>[] = [];
  const dropped: { id: number; reason: DropReason }[] = [];
  for (const game of raw) {
    const decision = classifyGame(game, { overrides, collections });
    if (decision.keep) {
      const collectionGames = decision.entryType === 'collection' ? (collections.get(game.id)?.games ?? []) : [];
      kept.push({ ...game, entryType: decision.entryType, collectionGames });
    }
    else dropped.push({ id: game.id, reason: decision.reason });
  }
  return { kept, dropped };
}

/** Normalizes IGDB `parent_game` (expanded object or bare id) for the contract. */
export function parentGameOf(game: CurationFields): { id: number; name: string } | null {
  const p = game.parent_game;
  if (p === null || p === undefined || typeof p === 'number') return null;
  return typeof p.name === 'string' ? { id: p.id, name: p.name } : null;
}
