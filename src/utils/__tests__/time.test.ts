import { timeAgo } from '../time';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const ago = (s: number) => new Date(NOW - s * 1000).toISOString();

describe('timeAgo', () => {
  it('formats without Intl.RelativeTimeFormat (missing on Hermes)', () => {
    const intl = Intl as { RelativeTimeFormat?: unknown };
    const original = intl.RelativeTimeFormat;
    delete intl.RelativeTimeFormat; // simulate the phone engine
    try {
      expect(timeAgo(ago(30), NOW)).toBe('just now');
      expect(timeAgo(ago(60), NOW)).toBe('1 minute ago');
      expect(timeAgo(ago(5 * 60), NOW)).toBe('5 minutes ago');
      expect(timeAgo(ago(3 * 3600), NOW)).toBe('3 hours ago');
      expect(timeAgo(ago(24 * 3600), NOW)).toBe('yesterday');
      expect(timeAgo(ago(3 * 24 * 3600), NOW)).toBe('3 days ago');
      expect(timeAgo(ago(8 * 24 * 3600), NOW)).toBe('last week');
      expect(timeAgo(ago(400 * 24 * 3600), NOW)).toBe('last year');
      expect(timeAgo(ago(-2 * 3600), NOW)).toBe('in 2 hours');
      expect(timeAgo('not a date', NOW)).toBe('just now');
    } finally {
      intl.RelativeTimeFormat = original;
    }
  });
});
