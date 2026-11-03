/**
 * Relative time labels without `Intl.RelativeTimeFormat`: Hermes (the phone
 * JS engine) doesn't ship it, and calling it crashes the screen on device.
 */
const UNITS: [unit: string, seconds: number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

const NEIGHBOURS: Record<string, [past: string, future: string]> = {
  year: ['last year', 'next year'],
  month: ['last month', 'next month'],
  week: ['last week', 'next week'],
  day: ['yesterday', 'tomorrow'],
};

/** "3 hours ago" / "yesterday" style label; "just now" under a minute. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (!Number.isFinite(abs) || abs < 60) return 'just now';
  for (const [unit, size] of UNITS) {
    if (abs < size) continue;
    const count = Math.round(abs / size);
    const past = seconds < 0;
    const neighbour = NEIGHBOURS[unit];
    if (count === 1 && neighbour) return past ? neighbour[0] : neighbour[1];
    const label = `${count} ${unit}${count === 1 ? '' : 's'}`;
    return past ? `${label} ago` : `in ${label}`;
  }
  return 'just now';
}
