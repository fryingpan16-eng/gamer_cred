const palettes = require('./src/constants/themePalettes.json');

const DEFAULT_THEME = 'blue';
const THEME_TOKENS = Object.keys(palettes[DEFAULT_THEME]);

/** "#3a3d36" → "58 61 54" (channel triplet for rgb(var(--x) / <alpha-value>)). */
const toTriplet = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/**
 * Compact, high-density retro type scale (desktop/tablet sizes, px: [size, line height]).
 * Below the `md` breakpoint (phones) every size is MOBILE_FONT_SCALE larger: the base
 * utilities carry the phone size and a min-width media rule restores these on wider screens.
 */
const FONT_SIZES = {
  'retrogamingpc-xs': [10, 12],
  'retrogamingpc-sm': [11, 14],
  'retrogamingpc-base': [12, 15],
  'retrogamingpc-lg': [14, 17],
  'retrogamingpc-xl': [18, 21],
};
const MOBILE_FONT_SCALE = 1.1;
const MD_BREAKPOINT = '768px';
const scaled = (px) => Math.round(px * MOBILE_FONT_SCALE * 10) / 10;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Must be 'class': NativeWind's web runtime (react-native-css-interop 0.2.x)
  // throws "Cannot manually set color scheme, as dark mode is type 'media'" on
  // load otherwise. Light/dark come from the palette CSS variables; no `dark:` variants.
  darkMode: 'class',
  theme: {
    extend: {
      // Theme colours are CSS variables (rgb channel triplets) so the palette can
      // switch at runtime. Values live in src/constants/themePalettes.json (the
      // single source); `:root` defaults to blue (DEFAULT_THEME) via the plugin below.
      colors: {
        ...Object.fromEntries(
          THEME_TOKENS.map((token) => [`retrogamingpc-${token}`, `rgb(var(--rgpc-${token}) / <alpha-value>)`]),
        ),
      },
      // Phones get the type scale 10% larger (see FONT_SIZES); desktop keeps the compact sizes.
      fontSize: Object.fromEntries(
        Object.entries(FONT_SIZES).map(([name, [size, lineHeight]]) => [
          name,
          [`${scaled(size)}px`, { lineHeight: `${scaled(lineHeight)}px` }],
        ]),
      ),
      maxWidth: {
        'retrogamingpc-window': '1180px',
      },
    },
  },
  plugins: [
    ({ addBase }) =>
      addBase({
        ':root': Object.fromEntries(
          THEME_TOKENS.map((token) => [`--rgpc-${token}`, toTriplet(palettes[DEFAULT_THEME][token])]),
        ),
      }),
    // Desktop/tablet: back to the compact sizes (comes after the base font utilities, so it wins at ≥ md).
    ({ addUtilities }) =>
      addUtilities({
        [`@media (min-width: ${MD_BREAKPOINT})`]: Object.fromEntries(
          Object.entries(FONT_SIZES).map(([name, [size, lineHeight]]) => [
            `.text-${name}`,
            { fontSize: `${size}px`, lineHeight: `${lineHeight}px` },
          ]),
        ),
      }),
  ],
};
