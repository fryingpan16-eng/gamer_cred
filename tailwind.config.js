/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // 2004 Valve Steam client palette — see CLAUDE.md
      colors: {
        'steam-dark': '#3a3d36',
        'steam-card': '#4c5046',
        'steam-panel': '#595e52',
        'steam-accent': '#6a725e',
        'steam-highlight': '#9da789',
        'steam-text': '#c4cdb4',
        'steam-text-bright': '#e6ebd6',
        'steam-text-muted': '#889177',
        'steam-button': '#52584a',
        'steam-button-border': '#737b67',
        'steam-active': '#79846b',
        // Bevel edge tones (light top/left, dark bottom/right)
        'steam-bevel-light': '#8a9278',
        'steam-bevel-dark': '#262823',
      },
      fontSize: {
        // Compact, high-density retro type scale
        'steam-xs': ['10px', { lineHeight: '12px' }],
        'steam-sm': ['11px', { lineHeight: '14px' }],
        'steam-base': ['12px', { lineHeight: '15px' }],
        'steam-lg': ['14px', { lineHeight: '17px' }],
        'steam-xl': ['18px', { lineHeight: '21px' }],
      },
      maxWidth: {
        'steam-window': '1180px',
      },
    },
  },
  plugins: [],
};
