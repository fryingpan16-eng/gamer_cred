/**
 * Curated platform catalog for the hardware roster.
 *
 * `id` is the IGDB platform id stored in user_platforms.platform_id, so roster
 * entries line up with IGDB game data. GamerCred-only entries that have no IGDB
 * platform (e.g. "PC Handheld") use reserved NEGATIVE ids, which can never
 * collide with IGDB's positive ids. The list is static on purpose: no API
 * call is needed to render a roster. Verify/extend ids against IGDB /platforms
 * (`fields id,name,abbreviation; where id = (...);`) when adding hardware.
 */
export type PlatformFamily = 'pc' | 'nintendo' | 'xbox' | 'playstation' | 'sega' | 'atari' | 'mobile';

export type PlatformInfo = {
  id: number;
  name: string;
  short: string;
  family: PlatformFamily;
  /** Computers accept a PC specs sheet. */
  hasSpecs?: true;
  /** The owner lists the specific devices they have (e.g. "Steam Deck OLED"). */
  hasDevices?: true;
  /** Overrides the family icon (see platformIcon). */
  icon?: PlatformIconName;
};

/**
 * Generic MaterialCommunityIcons glyphs — deliberately NOT console makers'
 * logos (those are trademarks); the chip label names the platform.
 */
export type PlatformIconName = 'desktop-tower-monitor' | 'laptop' | 'penguin' | 'gamepad-round' | 'gamepad-variant' | 'cellphone';

const FAMILY_ICONS: Record<PlatformFamily, PlatformIconName> = {
  pc: 'desktop-tower-monitor',
  nintendo: 'gamepad-variant',
  xbox: 'gamepad-variant',
  playstation: 'gamepad-variant',
  sega: 'gamepad-variant',
  atari: 'gamepad-variant',
  mobile: 'cellphone',
};

/** Reserved GamerCred-only platform ids (negative = not an IGDB platform). */
export const PC_HANDHELD_PLATFORM_ID = -1;

/** Quick-pick suggestions for the PC Handheld device list; users can type any name. */
export const PC_HANDHELD_SUGGESTIONS: readonly string[] = [
  'Steam Deck',
  'Steam Deck OLED',
  'ROG Ally',
  'ROG Ally X',
  'Legion Go',
  'Legion Go S',
  'MSI Claw',
  'AYANEO',
  'OneXPlayer',
  'GPD Win',
];

/** Display order for settings and profiles. `short` is the profile header's row label. */
export const PLATFORM_FAMILIES: readonly { key: PlatformFamily; label: string; short: string }[] = [
  { key: 'pc', label: 'PC', short: 'PC' },
  { key: 'nintendo', label: 'Nintendo', short: 'Nintendo' },
  { key: 'xbox', label: 'Xbox', short: 'Xbox' },
  { key: 'playstation', label: 'PlayStation', short: 'PlayStation' },
  { key: 'sega', label: 'Sega', short: 'Sega' },
  { key: 'atari', label: 'Atari', short: 'Atari' },
  { key: 'mobile', label: 'Mobile & Other', short: 'Other' },
];

export const PLATFORMS: readonly PlatformInfo[] = [
  { id: 6, name: 'PC (Windows)', short: 'PC', family: 'pc', hasSpecs: true },
  { id: 14, name: 'Mac', short: 'Mac', family: 'pc', hasSpecs: true, icon: 'laptop' },
  { id: 3, name: 'Linux', short: 'Linux', family: 'pc', hasSpecs: true, icon: 'penguin' },

  { id: PC_HANDHELD_PLATFORM_ID, name: 'PC Handheld', short: 'PC Handheld', family: 'pc', hasDevices: true, icon: 'gamepad-round' },

  { id: 167, name: 'PlayStation 5', short: 'PS5', family: 'playstation' },
  { id: 48, name: 'PlayStation 4', short: 'PS4', family: 'playstation' },
  { id: 9, name: 'PlayStation 3', short: 'PS3', family: 'playstation' },
  { id: 8, name: 'PlayStation 2', short: 'PS2', family: 'playstation' },
  { id: 7, name: 'PlayStation', short: 'PS1', family: 'playstation' },
  { id: 46, name: 'PlayStation Vita', short: 'Vita', family: 'playstation' },
  { id: 38, name: 'PlayStation Portable', short: 'PSP', family: 'playstation' },

  { id: 169, name: 'Xbox Series X|S', short: 'XSX|S', family: 'xbox' },
  { id: 49, name: 'Xbox One', short: 'XB1', family: 'xbox' },
  { id: 12, name: 'Xbox 360', short: 'X360', family: 'xbox' },
  { id: 11, name: 'Xbox', short: 'Xbox', family: 'xbox' },

  { id: 508, name: 'Nintendo Switch 2', short: 'Switch 2', family: 'nintendo' },
  { id: 130, name: 'Nintendo Switch', short: 'Switch', family: 'nintendo' },
  { id: 41, name: 'Wii U', short: 'Wii U', family: 'nintendo' },
  { id: 5, name: 'Wii', short: 'Wii', family: 'nintendo' },
  { id: 21, name: 'GameCube', short: 'GCN', family: 'nintendo' },
  { id: 4, name: 'Nintendo 64', short: 'N64', family: 'nintendo' },
  { id: 19, name: 'Super Nintendo', short: 'SNES', family: 'nintendo' },
  { id: 18, name: 'NES', short: 'NES', family: 'nintendo' },
  { id: 37, name: 'Nintendo 3DS', short: '3DS', family: 'nintendo' },
  { id: 20, name: 'Nintendo DS', short: 'DS', family: 'nintendo' },
  { id: 24, name: 'Game Boy Advance', short: 'GBA', family: 'nintendo' },
  { id: 22, name: 'Game Boy Color', short: 'GBC', family: 'nintendo' },
  { id: 33, name: 'Game Boy', short: 'GB', family: 'nintendo' },

  { id: 23, name: 'Dreamcast', short: 'DC', family: 'sega' },
  { id: 32, name: 'Sega Saturn', short: 'Saturn', family: 'sega' },
  { id: 29, name: 'Sega Genesis / Mega Drive', short: 'Genesis', family: 'sega' },

  // Ids checked against IGDB game data (2026-11-03).
  { id: 59, name: 'Atari 2600', short: '2600', family: 'atari' },
  { id: 66, name: 'Atari 5200', short: '5200', family: 'atari' },
  { id: 60, name: 'Atari 7800', short: '7800', family: 'atari' },
  { id: 61, name: 'Atari Lynx', short: 'Lynx', family: 'atari' },
  { id: 62, name: 'Atari Jaguar', short: 'Jaguar', family: 'atari' },

  { id: 39, name: 'iOS', short: 'iOS', family: 'mobile' },
  { id: 34, name: 'Android', short: 'Android', family: 'mobile' },
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

export function platformIcon(info: PlatformInfo): PlatformIconName {
  return info.icon ?? FAMILY_ICONS[info.family];
}

/** Unknown ids (e.g. added directly in the DB) still render with a generic label, under "Other". */
export function platformInfo(id: number): PlatformInfo {
  return BY_ID.get(id) ?? { id, name: `Platform #${id}`, short: `#${id}`, family: 'mobile' };
}

const CATALOG_INDEX = new Map(PLATFORMS.map((p, i) => [p.id, i]));

/**
 * Owned platforms grouped by maker, in PLATFORM_FAMILIES order; inside a group,
 * catalogue order (newest hardware first). Empty groups are left out.
 */
export function groupByFamily<T extends { platform_id: number }>(
  rows: readonly T[],
): { key: PlatformFamily; label: string; short: string; rows: T[] }[] {
  const order = (r: T) => CATALOG_INDEX.get(r.platform_id) ?? Number.MAX_SAFE_INTEGER;
  return PLATFORM_FAMILIES.map((family) => ({
    ...family,
    rows: rows
      .filter((r) => platformInfo(r.platform_id).family === family.key)
      .sort((a, b) => order(a) - order(b) || a.platform_id - b.platform_id),
  })).filter((g) => g.rows.length > 0);
}

/**
 * Default "played on" platform for a rating: the earliest-released platform
 * (IGDB release order, from the search/detail proxy) that is in our catalog.
 * Null when the game has no catalog platform (or no data yet).
 */
export function defaultPlayedOnPlatform(releasePlatformIds: readonly number[] | undefined): number | null {
  return (releasePlatformIds ?? []).find((id) => BY_ID.has(id)) ?? null;
}
