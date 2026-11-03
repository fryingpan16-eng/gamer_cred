/**
 * Theme-independent colours. Themed colours come from `useThemeColors()`
 * (src/hooks/useTheme.ts) so they follow the user's chosen palette.
 */
export const retroGamingPCStaticColors = {
  error: '#c45a3c',
} as const;

/** Fixed navigation chrome dimensions — constant so tab switches never shift layout. */
export const retroGamingPCLayout = {
  sidebarWidth: 200,
  bottomBarHeight: 52,
  headerHeight: 32,
} as const;
