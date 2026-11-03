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
export type PlatformFamily = 'pc' | 'handheld' | 'playstation' | 'xbox' | 'nintendo' | 'sega' | 'mobile';

export type PlatformInfo = {
  id: number;
  name: string;
  short: string;
  family: PlatformFamily;
  /** Computers accept a PC specs sheet. */
  hasSpecs?: true;
  /** The owner lists the specific devices they have (e.g. "Steam Deck OLED"). */
  hasDevices?: true;
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

export const PLATFORM_FAMILIES: readonly { key: PlatformFamily; label: string }[] = [
  { key: 'pc', label: 'Computers' },
  { key: 'handheld', label: 'PC Handhelds' },
  { key: 'playstation', label: 'PlayStation' },
  { key: 'xbox', label: 'Xbox' },
  { key: 'nintendo', label: 'Nintendo' },
  { key: 'sega', label: 'Sega' },
  { key: 'mobile', label: 'Mobile' },
];

export const PLATFORMS: readonly PlatformInfo[] = [
  { id: 6, name: 'PC (Windows)', short: 'PC', family: 'pc', hasSpecs: true },
  { id: 14, name: 'Mac', short: 'Mac', family: 'pc', hasSpecs: true },
  { id: 3, name: 'Linux', short: 'Linux', family: 'pc', hasSpecs: true },

  { id: PC_HANDHELD_PLATFORM_ID, name: 'PC Handheld', short: 'PC Handheld', family: 'handheld', hasDevices: true },

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

  // UNVERIFIED IGDB id: confirm with `fields id,name; where name ~ *"Switch 2"*;` on /platforms
  // before real users pick it (stored ids would need a data fix if this is wrong).
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

  { id: 39, name: 'iOS', short: 'iOS', family: 'mobile' },
  { id: 34, name: 'Android', short: 'Android', family: 'mobile' },
];

const BY_ID = new Map(PLATFORMS.map((p) => [p.id, p]));

/** Unknown ids (e.g. added directly in the DB) still render with a generic label. */
export function platformInfo(id: number): PlatformInfo {
  return BY_ID.get(id) ?? { id, name: `Platform #${id}`, short: `#${id}`, family: 'pc' };
}
