/**
 * Remasters are never catalogue entries (curation.ts drops them, one entry per
 * game). Instead they live on their original:
 *   - the game page lists them (name, year, platforms) in a "Remastered" card;
 *   - searching a remaster's name finds the original (its name becomes a search alias).
 * Other versions (expanded games: Director's Cut…) are folded the same way and
 * listed in the game page's "Other Versions" card.
 *
 * Pure, so it is unit-testable; index.ts wires it to IGDB. Part of the cache
 * rules version: changing anything here expires cached IGDB results.
 */
import type { GameRemaster } from '../_shared/igdb-contract.ts';

import { GAME_TYPE, gameTypeOf, isKeptSeparate, versionOriginalOf, type CurationFields } from './curation.ts';

/** IGDB fields for every game result (search cards' "Also remastered" line). */
export const REMASTER_RESULT_FIELDS = 'remasters.first_release_date,remasters.version_parent';

/** Extra fields for the game page's full list (the detail query already has REMASTER_RESULT_FIELDS; IGDB fields must not repeat). */
export const REMASTER_DETAIL_FIELDS = 'remasters.name,remasters.platforms.abbreviation,remasters.platforms.name';

/**
 * Other versions (IGDB "expanded games": Director's Cut, Royal, Golden…) fold
 * into their original the same way (curation.ts, versionOriginalOf). Result
 * cards get their short names ("Also: Director's Cut"), the game page a list.
 */
export const VERSION_RESULT_FIELDS = 'expanded_games.name';
export const VERSION_DETAIL_FIELDS =
  'expanded_games.first_release_date,expanded_games.version_parent,expanded_games.platforms.abbreviation,expanded_games.platforms.name';

/** Most short version names a result card carries. */
export const VERSION_NAMES_MAX = 3;

/** Most remaster names one original keeps as search aliases (and most originals fetched per search). */
export const REMASTER_ORIGINALS_MAX = 50;

export type RawRemaster = {
  id: number;
  name?: string;
  first_release_date?: number;
  version_parent?: number | null;
  platforms?: { abbreviation?: string; name?: string }[];
};

const yearOf = (seconds: number | undefined) => (typeof seconds === 'number' ? new Date(seconds * 1000).getUTCFullYear() : null);

/** The game page list: named remasters only (editions of a remaster are dropped), oldest first, one per name. */
export function mapRemasters(raw: readonly (RawRemaster | number)[] | undefined): GameRemaster[] {
  return mapNamed(raw, () => true);
}

/** The game page's other versions: like mapRemasters, minus versions that keep their own entry (Persona 5 Royal). */
export function mapVersions(raw: readonly (RawRemaster | number)[] | undefined): GameRemaster[] {
  return mapNamed(raw, (r) => !isKeptSeparate(r));
}

/** "Death Stranding Director's Cut" on Death Stranding → "Director's Cut"; other names stay whole. */
export function shortVersionName(name: string, originalName: string | undefined): string {
  const full = name.trim();
  const base = originalName?.trim() ?? '';
  if (base === '' || !full.toLowerCase().startsWith(base.toLowerCase())) return full;
  const rest = full.slice(base.length).replace(/^[\s:\-–—|,]+/, '').trim();
  return rest === '' ? full : rest;
}

/** Result cards: up to VERSION_NAMES_MAX short names of the versions folded into this game. */
export function versionNames(raw: readonly (RawRemaster | number)[] | undefined, originalName: string | undefined): string[] {
  return mapVersions(raw)
    .map((v) => shortVersionName(v.name, originalName))
    .slice(0, VERSION_NAMES_MAX);
}

function mapNamed(raw: readonly (RawRemaster | number)[] | undefined, keep: (r: RawRemaster) => boolean): GameRemaster[] {
  const seen = new Set<string>();
  const list: GameRemaster[] = [];
  for (const r of raw ?? []) {
    if (typeof r === 'number' || typeof r.name !== 'string' || r.name.trim() === '') continue;
    if (!keep(r)) continue;
    if (r.version_parent !== undefined && r.version_parent !== null) continue;
    const key = r.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const platforms = [
      ...new Set((r.platforms ?? []).map((p) => p.abbreviation ?? p.name).filter((p): p is string => typeof p === 'string' && p !== '')),
    ];
    list.push({ id: r.id, name: r.name.trim(), year: yearOf(r.first_release_date), platforms });
  }
  return list.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name));
}

/** For result cards: how many remasters (editions of one dropped) and their known years, ascending. */
export function summarizeRemasters(raw: readonly (RawRemaster | number)[] | undefined): { remasterCount: number; remasterYears: number[] } {
  const kept = new Map<number, number | null>();
  for (const r of raw ?? []) {
    if (typeof r === 'number') continue;
    if (r.version_parent !== undefined && r.version_parent !== null) continue;
    kept.set(r.id, yearOf(r.first_release_date));
  }
  const years = [...new Set([...kept.values()].filter((y): y is number => y !== null))].sort((a, b) => a - b);
  return { remasterCount: kept.size, remasterYears: years };
}

/**
 * Search hits that are remasters or folded versions → their original's id and
 * the names that should find it. Editions of a remaster and remasters with no
 * known original are ignored.
 */
export function remasterOriginals(raw: readonly CurationFields[]): Map<number, string[]> {
  const originals = new Map<number, string[]>();
  for (const g of raw) {
    if (typeof g.name !== 'string') continue;
    if (g.version_parent !== undefined && g.version_parent !== null) continue;
    let parentId: number | undefined;
    if (gameTypeOf(g) === GAME_TYPE.REMASTER) {
      const parent = g.parent_game;
      parentId = typeof parent === 'number' ? parent : parent?.id;
    } else {
      parentId = versionOriginalOf(g) ?? undefined;
    }
    if (typeof parentId !== 'number' || parentId === g.id) continue;
    if (!originals.has(parentId) && originals.size >= REMASTER_ORIGINALS_MAX) continue;
    const names = originals.get(parentId) ?? [];
    if (!names.includes(g.name)) names.push(g.name);
    originals.set(parentId, names);
  }
  return originals;
}
