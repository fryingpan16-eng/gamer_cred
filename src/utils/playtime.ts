import type { GameTimeToBeat } from '@/types/igdb';

/** Seconds → "~45m", "~2.5h", "~12h", "~120h" (half hours under 10h, whole hours above). */
export function formatPlaytime(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) return `~${Math.max(5, Math.round(seconds / 60 / 5) * 5)}m`;
  if (hours < 10) {
    const half = Math.round(hours * 2) / 2;
    return `~${Number.isInteger(half) ? half : half.toFixed(1)}h`;
  }
  return `~${Math.round(hours)}h`;
}

export const TIME_TO_BEAT_TIERS = [
  { key: 'main', label: 'Main story' },
  { key: 'extras', label: 'Main + extras' },
  { key: 'complete', label: 'Completionist' },
] as const satisfies readonly { key: keyof Omit<GameTimeToBeat, 'count'>; label: string }[];

/** The game page's compact line: the main story time, else the first tier that has one. */
export function headlinePlaytime(t: GameTimeToBeat | null | undefined): { label: string; text: string } | null {
  if (!t) return null;
  for (const tier of TIME_TO_BEAT_TIERS) {
    const s = t[tier.key];
    if (s !== null) return { label: tier.label, text: formatPlaytime(s) };
  }
  return null;
}
