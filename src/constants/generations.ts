/**
 * Console generations and the other badge groups (migration 000051).
 *
 * The database decides a game's group from its launch platforms
 * (`public.platform_generations`, `public.platform_group_of`); this file only
 * names them. The seeded "Top 250" list titles in 000051 are built from these
 * labels, and a SQL test fails if the two drift apart.
 *
 * Pure (no React Native imports) so the SQL tests can import it.
 */
export const GENERATION_GROUPS = [
  { key: '1', short: 'Gen 1', label: '1st Generation', years: '1972–1983' },
  { key: '2', short: 'Gen 2', label: '2nd Generation', years: '1976–1992' },
  { key: '3', short: 'Gen 3', label: '3rd Generation', years: '1983–2003' },
  { key: '4', short: 'Gen 4', label: '4th Generation', years: '1987–2004' },
  { key: '5', short: 'Gen 5', label: '5th Generation', years: '1993–2006' },
  { key: '6', short: 'Gen 6', label: '6th Generation', years: '1998–2013' },
  { key: '7', short: 'Gen 7', label: '7th Generation', years: '2005–2017' },
  { key: '8', short: 'Gen 8', label: '8th Generation', years: '2012–2020s' },
  { key: '9', short: 'Gen 9', label: '9th Generation', years: '2020–present' },
  // Not consoles: the badge shows the label with the release year under it.
  { key: 'pc', short: 'PC', label: 'PC & computers', years: null },
  { key: 'arcade', short: 'Arcade', label: 'Arcade', years: null },
  { key: 'mobile', short: 'Mobile', label: 'Mobile', years: null },
] as const;

export type GenerationKey = (typeof GENERATION_GROUPS)[number]['key'];
export type GenerationGroup = (typeof GENERATION_GROUPS)[number];

/** How many games each seeded generation list ranks. */
export const GENERATION_LIST_SIZE = 250;

const BY_KEY = new Map<string, GenerationGroup>(GENERATION_GROUPS.map((g) => [g.key, g]));

export function generationGroup(key: string | null | undefined): GenerationGroup | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

export function isConsoleGeneration(key: string): boolean {
  return /^[1-9]$/.test(key);
}

/** "6th Generation (1998–2013)", or "PC & computers". */
export function generationTitle(group: GenerationGroup): string {
  return group.years ? `${group.label} (${group.years})` : group.label;
}

/** Title of the seeded smart list, e.g. "Top 250: 6th Generation (1998–2013)". */
export function generationListTitle(group: GenerationGroup): string {
  return `Top ${GENERATION_LIST_SIZE}: ${generationTitle(group)}`;
}

/** Display order (Gen 1 → 9, then PC, Arcade, Mobile); unknown keys last. */
export function generationSortIndex(key: string): number {
  const i = GENERATION_GROUPS.findIndex((g) => g.key === key);
  return i === -1 ? GENERATION_GROUPS.length : i;
}
