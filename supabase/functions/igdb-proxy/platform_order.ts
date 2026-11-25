/**
 * A game's platforms in release order (earliest first), as IGDB platform ids.
 * The app defaults a rating's "played on" platform to the first of these that
 * is in its catalog (src/constants/platforms.ts uses IGDB platform ids).
 *
 * Release dates with a real date come first, oldest first; undated releases
 * and platforms with no release-date entry follow in IGDB's platform order.
 */
export type RawReleaseDate = { date?: number; platform?: { id?: number } | number };
export type RawPlatformRef = { id?: number } | number;

const idOf = (ref: RawPlatformRef | undefined): number | null => {
  const id = typeof ref === 'number' ? ref : ref?.id;
  return typeof id === 'number' && Number.isSafeInteger(id) ? id : null;
};

export function releasePlatformOrder(releaseDates: RawReleaseDate[] | undefined, platforms: RawPlatformRef[] | undefined): number[] {
  const dated = (releaseDates ?? [])
    .map((r) => ({ id: idOf(r.platform), date: typeof r.date === 'number' ? r.date : Number.POSITIVE_INFINITY }))
    .filter((r): r is { id: number; date: number } => r.id !== null)
    .sort((a, b) => a.date - b.date);
  const ordered = [...dated.map((r) => r.id), ...(platforms ?? []).map(idOf).filter((id): id is number => id !== null)];
  return [...new Set(ordered)];
}

/** Releases this close to the first one count as the same launch (staggered regions, a port weeks later). */
export const LAUNCH_WINDOW_DAYS = 90;

/**
 * The platforms a game launched on: every platform whose first dated release
 * is within LAUNCH_WINDOW_DAYS of the game's earliest release. With no dates
 * at all, every listed platform. The database picks the badge generation from
 * these (migration 000051: a console beats PC, the oldest console wins).
 */
export function launchPlatforms(releaseDates: RawReleaseDate[] | undefined, platforms: RawPlatformRef[] | undefined): number[] {
  const firstDate = new Map<number, number>();
  for (const r of releaseDates ?? []) {
    const id = idOf(r.platform);
    if (id === null || typeof r.date !== 'number') continue;
    firstDate.set(id, Math.min(firstDate.get(id) ?? Number.POSITIVE_INFINITY, r.date));
  }
  if (firstDate.size === 0) {
    return [...new Set((platforms ?? []).map(idOf).filter((id): id is number => id !== null))];
  }
  const earliest = Math.min(...firstDate.values());
  const cutoff = earliest + LAUNCH_WINDOW_DAYS * 86_400;
  return [...firstDate.entries()]
    .filter(([, date]) => date <= cutoff)
    .sort((a, b) => a[1] - b[1] || a[0] - b[0])
    .map(([id]) => id);
}
