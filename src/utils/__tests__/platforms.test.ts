import { PC_HANDHELD_PLATFORM_ID, PLATFORM_FAMILIES, PLATFORMS, platformIcon, platformInfo } from '@/constants/platforms';
import { MAX_PLATFORM_DEVICES, platformDevicesSchema } from '@/utils/profileSchemas';

describe('platform catalog', () => {
  it('has unique ids and only known families', () => {
    const ids = PLATFORMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const families = new Set(PLATFORM_FAMILIES.map((f) => f.key));
    for (const p of PLATFORMS) expect(families.has(p.family)).toBe(true);
  });

  it('uses negative ids only for GamerCred-only entries', () => {
    expect(PC_HANDHELD_PLATFORM_ID).toBeLessThan(0);
    expect(platformInfo(PC_HANDHELD_PLATFORM_ID)).toMatchObject({ name: 'PC Handheld', hasDevices: true });
  });

  it('includes Nintendo Switch 2 alongside the original Switch', () => {
    expect(PLATFORMS.find((p) => p.name === 'Nintendo Switch 2')).toMatchObject({ family: 'nintendo' });
    expect(platformInfo(130).name).toBe('Nintendo Switch');
  });
});

describe('platform icons', () => {
  it('every platform gets a generic (non-logo) icon', () => {
    const GENERIC = new Set(['desktop-tower-monitor', 'laptop', 'penguin', 'gamepad-round', 'gamepad-variant', 'cellphone']);
    for (const p of PLATFORMS) expect(GENERIC.has(platformIcon(p))).toBe(true);
    expect(platformIcon(platformInfo(PC_HANDHELD_PLATFORM_ID))).toBe('gamepad-round');
    expect(platformIcon(platformInfo(14))).toBe('laptop');
  });
});

describe('platform devices', () => {
  it('trims, collapses whitespace and de-duplicates case-insensitively', () => {
    expect(platformDevicesSchema.parse(['  Steam   Deck ', 'steam deck', 'ROG Ally X'])).toEqual(['Steam Deck', 'ROG Ally X']);
  });

  it('rejects empty names, overly long names and too many devices', () => {
    expect(platformDevicesSchema.safeParse(['   ']).success).toBe(false);
    expect(platformDevicesSchema.safeParse(['x'.repeat(41)]).success).toBe(false);
    const tooMany = Array.from({ length: MAX_PLATFORM_DEVICES + 1 }, (_, i) => `Device ${i}`);
    expect(platformDevicesSchema.safeParse(tooMany).success).toBe(false);
    expect(platformDevicesSchema.safeParse(tooMany.slice(0, MAX_PLATFORM_DEVICES)).success).toBe(true);
  });
});
