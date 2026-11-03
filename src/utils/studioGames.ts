import type { IgdbCompanyGame } from '@/types/igdb';

export type StudioRoleFilter = 'all' | 'developer' | 'publisher';
export type StudioSort = 'newest' | 'oldest' | 'rating' | 'name';

/** Filters a studio's games by role and sorts them (undated / unrated always last). */
export function studioGames(games: readonly IgdbCompanyGame[], role: StudioRoleFilter, sort: StudioSort): IgdbCompanyGame[] {
  const filtered = role === 'all' ? [...games] : games.filter((g) => g.roles.includes(role));
  const byName = (a: IgdbCompanyGame, b: IgdbCompanyGame) => a.name.localeCompare(b.name);
  const last = (v: number | null, dir: 1 | -1) => (v === null ? Number.POSITIVE_INFINITY : dir * v);
  switch (sort) {
    case 'newest':
      return filtered.sort((a, b) => last(a.releaseYear, -1) - last(b.releaseYear, -1) || byName(a, b));
    case 'oldest':
      return filtered.sort((a, b) => last(a.releaseYear, 1) - last(b.releaseYear, 1) || byName(a, b));
    case 'rating':
      return filtered.sort((a, b) => last(a.rating, -1) - last(b.rating, -1) || byName(a, b));
    case 'name':
      return filtered.sort(byName);
  }
}

/** How many games the studio developed / published (for the filter labels). */
export function studioRoleCounts(games: readonly IgdbCompanyGame[]): Record<StudioRoleFilter, number> {
  return {
    all: games.length,
    developer: games.filter((g) => g.roles.includes('developer')).length,
    publisher: games.filter((g) => g.roles.includes('publisher')).length,
  };
}
