/**
 * Studio pages (action 'company'): which game ids to fetch for a company, and
 * how to tag + order the curated results. Pure, so it is unit-tested.
 */
import type { CompanyGameRole, IgdbCompanyGame, IgdbGameResult } from '../_shared/igdb-contract.ts';

/** IGDB returns at most 500 records per request. */
export const IGDB_PAGE_MAX = 500;

/**
 * De-duplicated ids to fetch: developed titles first (they define a studio),
 * then published-only ones, capped at `max`.
 */
export function companyGameIds(
  developed: readonly number[] | undefined,
  published: readonly number[] | undefined,
  max: number,
): { ids: number[]; truncated: boolean } {
  const all = [...new Set([...(developed ?? []), ...(published ?? [])])].filter((id) => Number.isSafeInteger(id) && id > 0);
  return { ids: all.slice(0, max), truncated: all.length > max };
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Tags each game with the company's role(s) and orders newest first (undated last, then by name). */
export function tagCompanyGames(
  games: readonly IgdbGameResult[],
  developed: readonly number[] | undefined,
  published: readonly number[] | undefined,
): IgdbCompanyGame[] {
  const dev = new Set(developed ?? []);
  const pub = new Set(published ?? []);
  return games
    .map((game) => {
      const roles: CompanyGameRole[] = [];
      if (dev.has(game.id)) roles.push('developer');
      if (pub.has(game.id)) roles.push('publisher');
      return { ...game, roles };
    })
    .filter((game) => game.roles.length > 0)
    .sort((a, b) => (b.releaseYear ?? -1) - (a.releaseYear ?? -1) || a.name.localeCompare(b.name));
}
