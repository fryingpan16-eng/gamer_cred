import { formatPlaytime, headlinePlaytime } from '../playtime';

describe('formatPlaytime', () => {
  it('rounds to minutes, half hours, then whole hours', () => {
    expect(formatPlaytime(60)).toBe('~5m');
    expect(formatPlaytime(44 * 60)).toBe('~45m');
    expect(formatPlaytime(3600)).toBe('~1h');
    expect(formatPlaytime(2.3 * 3600)).toBe('~2.5h');
    expect(formatPlaytime(9.9 * 3600)).toBe('~10h');
    expect(formatPlaytime(12.4 * 3600)).toBe('~12h');
    expect(formatPlaytime(120 * 3600)).toBe('~120h');
  });
});

describe('headlinePlaytime', () => {
  it('prefers the main story, falls back to the next tier, null when empty', () => {
    expect(headlinePlaytime({ main: 43200, extras: 64800, complete: null, count: 4 })).toEqual({ label: 'Main story', text: '~12h' });
    expect(headlinePlaytime({ main: null, extras: 64800, complete: null, count: 1 })).toEqual({ label: 'Main + extras', text: '~18h' });
    expect(headlinePlaytime({ main: null, extras: null, complete: null, count: 0 })).toBeNull();
    expect(headlinePlaytime(undefined)).toBeNull();
  });
});
