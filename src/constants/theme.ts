/**
 * Theme-independent colours. Themed colours come from `useThemeColors()`
 * (src/hooks/useTheme.ts) so they follow the user's chosen palette.
 */
export const retroGamingPCStaticColors = {
  /** Bright enough for ≥ 4.5:1 on every dark theme surface. */
  error: '#ff8a7a',
} as const;

/** Fixed navigation chrome dimensions — constant so tab switches never shift layout. */
export const retroGamingPCLayout = {
  sidebarWidth: 200,
  bottomBarHeight: 52,
  headerHeight: 32,
} as const;
