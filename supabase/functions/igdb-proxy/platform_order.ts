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
