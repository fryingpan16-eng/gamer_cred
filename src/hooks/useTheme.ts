import { vars } from 'nativewind';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';

import {
  DEFAULT_THEME,
  isLightTheme,
  isThemeName,
  themeCssVariables,
  themePalette,
  type ThemeName,
  type ThemePalette,
} from '@/constants/themes';
import { ExpoSecureStoreAdapter, WebStorageAdapter } from '@/services/supabase';

/** Device-local cache so the chosen theme applies before sign-in / profile load. */
const STORAGE_KEY = 'gamercred.ui-theme';
const storage = Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter;

type ThemeState = {
  theme: ThemeName;
  /** Apply a theme now and remember it on this device. */
  setTheme: (theme: ThemeName) => void;
  /**
   * Load the device-cached theme (call once at startup). `shouldApply` lets the
   * caller skip it if a fresher source (the signed-in profile) arrived first.
   */
  hydrate: (shouldApply?: () => boolean) => Promise<void>;
};

/**
 * Web only: modals render in a portal outside the themed root view, so the
 * variables are also set on <html> to reach them.
 */
function applyToDocument(theme: ThemeName): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  for (const [name, value] of Object.entries(themeCssVariables(theme))) {
    document.documentElement.style.setProperty(name, value);
  }
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme) => {
    if (theme === get().theme) return;
    set({ theme });
    applyToDocument(theme);
    void Promise.resolve(storage.setItem(STORAGE_KEY, theme)).catch(() => undefined);
  },
  hydrate: async (shouldApply = () => true) => {
    try {
      const cached = await storage.getItem(STORAGE_KEY);
      if (isThemeName(cached) && cached !== get().theme && shouldApply()) {
        set({ theme: cached });
        applyToDocument(cached);
      }
    } catch {
      // Unreadable cache: keep the default.
    }
  },
}));

/** The active theme's hex palette for JS-side styling (icons, navigator options, placeholders). */
export function useThemeColors(): ThemePalette {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => themePalette(theme), [theme]);
}

/** True for the light theme (dark status bar text, dark dividers). */
export function useIsLightTheme(): boolean {
  return useThemeStore((s) => isLightTheme(s.theme));
}

/** A faint line between rows: light on the dark themes, dark on the light one. */
export function useDividerColor(alpha = 0.12): string {
  return useIsLightTheme() ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
}

/** NativeWind `vars()` style for the themed root view. */
export function useThemeVars() {
  const theme = useThemeStore((s) => s.theme);
  return useMemo(() => vars(themeCssVariables(theme)), [theme]);
}
