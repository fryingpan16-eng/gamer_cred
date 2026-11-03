import { groupByFamily, PC_HANDHELD_PLATFORM_ID, PLATFORM_FAMILIES, PLATFORMS, platformIcon, platformInfo } from '@/constants/platforms';
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

  it('groups Atari systems by their IGDB ids, and handhelds under PC', () => {
    const atari = PLATFORMS.filter((p) => p.family === 'atari').map((p) => [p.id, p.short]);
    expect(atari).toEqual([
      [59, '2600'],
      [66, '5200'],
      [60, '7800'],
      [61, 'Lynx'],
      [62, 'Jaguar'],
    ]);
    expect(platformInfo(PC_HANDHELD_PLATFORM_ID).family).toBe('pc');
    expect(PLATFORM_FAMILIES.map((f) => f.label)).toEqual(['PC', 'Nintendo', 'Xbox', 'PlayStation', 'Sega', 'Atari', 'Mobile & Other']);
  });
});

describe('groupByFamily', () => {
  it('groups by maker in display order, newest hardware first, skipping empty groups', () => {
    const rows = [33, 6, 48, 130, 34, PC_HANDHELD_PLATFORM_ID, 167, 9999].map((platform_id) => ({ platform_id }));
    expect(groupByFamily(rows).map((g) => [g.short, g.rows.map((r) => r.platform_id)])).toEqual([
      ['PC', [6, PC_HANDHELD_PLATFORM_ID]],
      ['Nintendo', [130, 33]],
      ['PlayStation', [167, 48]],
      ['Other', [34, 9999]],
    ]);
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
