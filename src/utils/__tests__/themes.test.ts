import palettes from '@/constants/themePalettes.json';
import {
  DEFAULT_THEME,
  hexToTriplet,
  NEUTRAL_TEXT_TOKENS,
  isThemeName,
  THEME_LABELS,
  THEME_NAMES,
  THEME_TOKENS,
  themeCssVariables,
  themePalette,
  type ThemeName,
} from '@/constants/themes';

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const PAIRS: [string, string][] = [
  ['text', 'dark'],
  ['text-bright', 'card'],
  ['text-bright', 'panel'],
  ['text-muted', 'dark'],
  ['highlight', 'dark'],
];

describe('colour themes', () => {
  it('offers blue (default, listed first), olive, red, yellow and pink', () => {
    expect(THEME_NAMES).toEqual(['blue', 'olive', 'red', 'yellow', 'pink']);
    expect(DEFAULT_THEME).toBe('blue');
    expect(THEME_NAMES.map((n) => THEME_LABELS[n])).toEqual(['Mega', 'Chief', 'Super', 'Pika', 'Peach']);
    expect(Object.keys(palettes).sort()).toEqual([...THEME_NAMES].sort());
  });

  it.each(THEME_NAMES)('%s defines every token as a 6-digit hex colour', (name) => {
    const palette = palettes[name] as Record<string, string>;
    expect(Object.keys(palette).sort()).toEqual([...THEME_TOKENS].sort());
    for (const hex of Object.values(palette)) expect(hex).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(THEME_NAMES.filter((n) => n !== 'olive'))('%s keeps olive’s text contrast (±0.25)', (name) => {
    const olive = palettes.olive as Record<string, string>;
    const theme = palettes[name] as Record<string, string>;
    for (const [fg, bg] of PAIRS) {
      expect(Math.abs(contrast(theme[fg]!, theme[bg]!) - contrast(olive[fg]!, olive[bg]!))).toBeLessThan(0.25);
    }
  });

  it('text is neutral grey (no tint) and identical in every theme', () => {
    for (const token of NEUTRAL_TEXT_TOKENS) {
      const values = new Set(THEME_NAMES.map((n) => (palettes[n] as Record<string, string>)[token]));
      expect(values.size).toBe(1);
      const hex = [...values][0]!;
      expect(hex.slice(1, 3)).toBe(hex.slice(3, 5)); // R = G
      expect(hex.slice(3, 5)).toBe(hex.slice(5, 7)); // G = B
    }
  });

  it.each(THEME_NAMES)('%s is high contrast (AAA body text, AA everything else)', (name) => {
    const t = palettes[name] as Record<string, string>;
    for (const surface of ['dark', 'card', 'panel', 'button']) {
      expect(contrast(t.text!, t[surface]!)).toBeGreaterThanOrEqual(7); // WCAG AAA
      expect(contrast(t['text-bright']!, t[surface]!)).toBeGreaterThanOrEqual(7);
      expect(contrast(t['text-muted']!, t[surface]!)).toBeGreaterThanOrEqual(4.5); // WCAG AA
    }
    expect(contrast(t['text-bright']!, t.active!)).toBeGreaterThanOrEqual(4.5); // primary buttons
    expect(contrast(t.ink!, t.highlight!)).toBeGreaterThanOrEqual(4.5); // "Main" badge
  });

  it.each(THEME_NAMES)('%s is a dark theme (backgrounds near black)', (name) => {
    const t = palettes[name] as Record<string, string>;
    expect(luminance(t.dark!)).toBeLessThan(0.015);
    expect(luminance(t.card!)).toBeLessThan(0.02);
  });

  it('builds JS palettes and CSS variables', () => {
    expect(themePalette('blue').textBright).toBe(palettes.blue['text-bright']);
    expect(hexToTriplet('#3a3d36')).toBe('58 61 54');
    expect(themeCssVariables('olive')['--rgpc-dark']).toBe(hexToTriplet(palettes.olive.dark));
    expect(Object.keys(themeCssVariables('pink'))).toHaveLength(THEME_TOKENS.length);
  });

  it('validates theme names', () => {
    for (const n of THEME_NAMES) expect(isThemeName(n)).toBe(true);
    expect(isThemeName('green')).toBe(false);
    expect(isThemeName(undefined)).toBe(false);
  });

  it('tailwind.config.js maps every token to a CSS variable and defaults :root to the default theme', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = require('../../../tailwind.config.js') as {
      theme: { extend: { colors: Record<string, string> } };
      plugins: ((api: { addBase: (base: Record<string, Record<string, string>>) => void }) => void)[];
    };
    for (const token of THEME_TOKENS) {
      expect(config.theme.extend.colors[`retrogamingpc-${token}`]).toBe(`rgb(var(--rgpc-${token}) / <alpha-value>)`);
    }
    let root: Record<string, string> = {};
    config.plugins[0]!({ addBase: (base) => (root = base[':root']!) });
    expect(root).toEqual(themeCssVariables(DEFAULT_THEME as ThemeName));
  });
});
