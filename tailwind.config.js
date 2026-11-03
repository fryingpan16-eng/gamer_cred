const palettes = require('./src/constants/themePalettes.json');

const DEFAULT_THEME = 'blue';
const THEME_TOKENS = Object.keys(palettes[DEFAULT_THEME]);

/** "#3a3d36" → "58 61 54" (channel triplet for rgb(var(--x) / <alpha-value>)). */
const toTriplet = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Must be 'class': NativeWind's web runtime (react-native-css-interop 0.2.x)
  // throws "Cannot manually set color scheme, as dark mode is type 'media'" on
  // load otherwise. The app is dark-only and uses no `dark:` variants.
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
        // Semantic, not themed.
        // Bright enough for ≥ 4.5:1 on every dark theme surface.
        'retrogamingpc-error': '#ff8a7a',
      },
      fontSize: {
        // Compact, high-density retro type scale
        'retrogamingpc-xs': ['10px', { lineHeight: '12px' }],
        'retrogamingpc-sm': ['11px', { lineHeight: '14px' }],
        'retrogamingpc-base': ['12px', { lineHeight: '15px' }],
        'retrogamingpc-lg': ['14px', { lineHeight: '17px' }],
        'retrogamingpc-xl': ['18px', { lineHeight: '21px' }],
      },
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
  ],
};
