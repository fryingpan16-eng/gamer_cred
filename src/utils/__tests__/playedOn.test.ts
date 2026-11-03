import { defaultPlayedOnPlatform } from '@/constants/platforms';

describe('default "played on" platform', () => {
  it('is the earliest-released platform that is in the catalog', () => {
    // 15 = Commodore 64 (not in the catalog) came first, then PS2 (8), then PS4 (48)
    expect(defaultPlayedOnPlatform([15, 8, 48])).toBe(8);
    expect(defaultPlayedOnPlatform([167, 6])).toBe(167);
  });

  it('is null when nothing is known or nothing is in the catalog', () => {
    expect(defaultPlayedOnPlatform(undefined)).toBeNull();
    expect(defaultPlayedOnPlatform([])).toBeNull();
    expect(defaultPlayedOnPlatform([15, 16])).toBeNull();
  });
});
