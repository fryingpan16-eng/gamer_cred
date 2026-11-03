/**
 * RetroGamingPC colour themes. The palettes themselves live in
 * themePalettes.json — the single source read by both this module and
 * tailwind.config.js (which maps every token to a CSS variable).
 *
 * Every non-default palette is the olive palette hue-rotated with each
 * token's relative luminance held equal, so text contrast is the same in
 * every theme (enforced by src/utils/__tests__/themes.test.ts).
 */
import palettes from './themePalettes.json';

export type ThemeName = 'olive' | 'blue' | 'red' | 'yellow' | 'pink';

export const THEME_NAMES: readonly ThemeName[] = ['olive', 'blue', 'red', 'yellow', 'pink'];
export const DEFAULT_THEME: ThemeName = 'olive';

export const THEME_LABELS: Record<ThemeName, string> = {
  olive: 'Olive',
  blue: 'Blue',
  red: 'Red',
  yellow: 'Yellow',
  pink: 'Pink',
};

/** Token names as used in Tailwind classes (`bg-retrogamingpc-<token>`). */
export type ThemeToken = keyof (typeof palettes)['olive'];

export const THEME_TOKENS = Object.keys(palettes.olive) as ThemeToken[];

/** JS-side palette (camelCase keys) for navigator options, icon colours, etc. */
export type ThemePalette = {
  dark: string;
  card: string;
  panel: string;
  accent: string;
  highlight: string;
  text: string;
  textBright: string;
  textMuted: string;
  button: string;
  buttonBorder: string;
  active: string;
  bevelLight: string;
  bevelDark: string;
};

const camel = (token: string) => token.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}

/** Hex palette for a theme. */
export function themePalette(name: ThemeName): ThemePalette {
  const source = palettes[name] as Record<ThemeToken, string>;
  return Object.fromEntries(THEME_TOKENS.map((t) => [camel(t), source[t]])) as ThemePalette;
}

/** "#3a3d36" → "58 61 54". */
export function hexToTriplet(hex: string): string {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');
}

/** CSS variable assignments for a theme (`--rgpc-<token>: "r g b"`). */
export function themeCssVariables(name: ThemeName): Record<`--rgpc-${ThemeToken}`, string> {
  const source = palettes[name] as Record<ThemeToken, string>;
  return Object.fromEntries(THEME_TOKENS.map((t) => [`--rgpc-${t}`, hexToTriplet(source[t])])) as Record<
    `--rgpc-${ThemeToken}`,
    string
  >;
}
