/**
 * 2004 Steam palette for JS-side styling (navigator options, icon colors,
 * placeholderTextColor) where Tailwind classes cannot be used.
 * MUST stay in sync with `theme.extend.colors` in tailwind.config.js.
 */
export const steamColors = {
  dark: '#3a3d36',
  card: '#4c5046',
  panel: '#595e52',
  accent: '#6a725e',
  highlight: '#9da789',
  text: '#c4cdb4',
  textBright: '#e6ebd6',
  textMuted: '#889177',
  button: '#52584a',
  buttonBorder: '#737b67',
  active: '#79846b',
  bevelLight: '#8a9278',
  bevelDark: '#262823',
  error: '#c45a3c',
} as const;

/** Fixed navigation chrome dimensions — constant so tab switches never shift layout. */
export const steamLayout = {
  sidebarWidth: 200,
  bottomBarHeight: 52,
  headerHeight: 32,
} as const;
