/**
 * Spreadsheet-style list of a player's ratings: pure sort + filter over rows
 * already in memory (one RPC returns the whole list). Unit-tested.
 */
import { platformInfo } from '@/constants/platforms';
import type { TierCode } from '@/constants/ratingRubric';

import { deriveAllScales, type StoredRating } from './rating';
import { UNKNOWN_LABEL } from './stats';

export type RatingsTableRow = {
  gameId: number;
  name: string;
  rating: StoredRating;
  /** Canonical 1–100. */
  score: number;
  tier: TierCode;
  stars: number;
  platformId: number | null;
  platform: string;
  year: number | null;
  genres: string[];
  developers: string[];
  ratedAt: string;
  reviewId: string | null;
};

export type SortKey = 'name' | 'score' | 'platform' | 'year' | 'genre' | 'developer' | 'rated' | 'review';
export type SortDir = 'asc' | 'desc';
export type TableSort = { key: SortKey; dir: SortDir };

export type ReviewFilter = 'any' | 'reviewed' | 'notReviewed';

export type TableFilters = {
  /** Case-insensitive match on title, developer or genre. */
  text: string;
  /** Empty = any. */
  platforms: string[];
  tiers: TierCode[];
  genres: string[];
  reviewed: ReviewFilter;
  /** Inclusive 1–100 range; null = open. */
  minScore: number | null;
  maxScore: number | null;
};

export const EMPTY_FILTERS: TableFilters = {
  text: '',
  platforms: [],
  tiers: [],
  genres: [],
  reviewed: 'any',
  minScore: null,
  maxScore: null,
};

export const DEFAULT_SORT: TableSort = { key: 'rated', dir: 'desc' };

/** A fresh sort on a column starts in its natural direction (scores high → low, names A → Z). */
export function firstDirection(key: SortKey): SortDir {
  return key === 'name' || key === 'platform' || key === 'genre' || key === 'developer' ? 'asc' : 'desc';
}

/** Clicking a header: same column flips direction, a new column starts at its natural direction. */
export function nextSort(current: TableSort, key: SortKey): TableSort {
  return current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: firstDirection(key) };
}

export type RatingsTableSource = {
  game_id: number;
  rating: StoredRating;
  platform_id: number | null;
  rated_at: string;
  name: string | null;
  release_year: number | null;
  genres: string[];
  developers: string[];
  community_rating: number | null;
  review_id: string | null;
};

export function toTableRow(src: RatingsTableSource, fallbackName?: string): RatingsTableRow {
  const derived = deriveAllScales(src.rating.numeric);
  return {
    gameId: src.game_id,
    name: src.name ?? fallbackName ?? `Game #${src.game_id}`,
    rating: src.rating,
    score: src.rating.numeric,
    tier: derived.tier,
    stars: derived.stars,
    platformId: src.platform_id,
    platform: src.platform_id === null ? UNKNOWN_LABEL : platformInfo(src.platform_id).short,
    year: src.release_year,
    genres: src.genres.length > 0 ? src.genres : [UNKNOWN_LABEL],
    developers: src.developers.length > 0 ? src.developers : [UNKNOWN_LABEL],
    ratedAt: src.rated_at,
    reviewId: src.review_id,
  };
}

function matches(row: RatingsTableRow, f: TableFilters): boolean {
  const q = f.text.trim().toLowerCase();
  if (q && ![row.name, ...row.developers, ...row.genres].some((v) => v.toLowerCase().includes(q))) return false;
  if (f.platforms.length > 0 && !f.platforms.includes(row.platform)) return false;
  if (f.tiers.length > 0 && !f.tiers.includes(row.tier)) return false;
  if (f.genres.length > 0 && !row.genres.some((g) => f.genres.includes(g))) return false;
  if (f.reviewed === 'reviewed' && row.reviewId === null) return false;
  if (f.reviewed === 'notReviewed' && row.reviewId !== null) return false;
  if (f.minScore !== null && row.score < f.minScore) return false;
  if (f.maxScore !== null && row.score > f.maxScore) return false;
  return true;
}

/** Comparable value for a column; null = blank (always sorted last). */
function sortValue(row: RatingsTableRow, key: SortKey): string | number | null {
  switch (key) {
    case 'name':
      return row.name.toLowerCase();
    case 'score':
      return row.score;
    case 'platform':
      return row.platformId === null ? null : row.platform.toLowerCase();
    case 'year':
      return row.year;
    case 'genre':
      return row.genres[0] === UNKNOWN_LABEL ? null : row.genres[0]!.toLowerCase();
    case 'developer':
      return row.developers[0] === UNKNOWN_LABEL ? null : row.developers[0]!.toLowerCase();
    case 'rated':
      return row.ratedAt;
    case 'review':
      return row.reviewId === null ? 0 : 1;
  }
}

/** Filter then sort (stable; ties fall back to title A → Z; blanks always last). */
export function applyTable(rows: readonly RatingsTableRow[], filters: TableFilters, sort: TableSort): RatingsTableRow[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  return rows
    .filter((r) => matches(r, filters))
    .map((row, i) => ({ row, i, v: sortValue(row, sort.key) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) {
        if (a.v !== b.v) return a.v === null ? 1 : -1;
      } else if (a.v !== b.v) {
        return (a.v < b.v ? -1 : 1) * dir;
      }
      return a.row.name.localeCompare(b.row.name) || a.i - b.i;
    })
    .map((x) => x.row);
}

/** Distinct values (with counts) for a filter menu, most common first; Unknown last. */
export function facet(rows: readonly RatingsTableRow[], pick: (r: RatingsTableRow) => string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of rows) for (const v of new Set(pick(r))) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.value === UNKNOWN_LABEL ? 1 : b.value === UNKNOWN_LABEL ? -1 : b.count - a.count || a.value.localeCompare(b.value)));
}

export function activeFilterCount(f: TableFilters): number {
  return (
    (f.text.trim() ? 1 : 0) +
    (f.platforms.length > 0 ? 1 : 0) +
    (f.tiers.length > 0 ? 1 : 0) +
    (f.genres.length > 0 ? 1 : 0) +
    (f.reviewed !== 'any' ? 1 : 0) +
    (f.minScore !== null || f.maxScore !== null ? 1 : 0)
  );
}
