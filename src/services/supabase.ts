import './cryptoPolyfill';

import { createClient, type SupportedStorage } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database.types';

// -----------------------------------------------------------------------------
// Session storage
// -----------------------------------------------------------------------------

/**
 * Max characters per SecureStore value. Supabase sessions (JWT + refresh token +
 * user metadata such as Google avatar URLs) routinely exceed the ~2KB some
 * iOS/Android keychains accept, so values are split into chunks:
 *   `${key}.count` → number of chunks
 *   `${key}.0` … `${key}.N-1` → chunk payloads
 * SecureStore keys may only contain [A-Za-z0-9._-]; Supabase keys
 * (`sb-<ref>-auth-token`, `…-code-verifier-<flowId>`) satisfy that.
 */
const CHUNK_SIZE = 1800;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(`${key}.count`);
  const count = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export const ExpoSecureStoreAdapter: SupportedStorage = {
  async getItem(key) {
    try {
      const count = await readCount(key);
      if (count === 0) return null;
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
      );
      // A missing chunk means a partial/corrupt write — treat the session as absent.
      if (chunks.some((c) => c === null)) return null;
      return chunks.join('');
    } catch (error) {
      // Keychain can be unavailable (e.g. device locked, restored backup). Never block boot.
      console.warn('[auth-storage] read failed', error);
      return null;
    }
  },

  async setItem(key, value) {
    const previous = await readCount(key);
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    // Invalidate first so a crash mid-write never leaves a mixed old/new session.
    await SecureStore.deleteItemAsync(`${key}.count`);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}.count`, String(count));
    // Remove stale trailing chunks from a previously longer value.
    for (let i = count; i < previous; i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  },

  async removeItem(key) {
    const count = await readCount(key);
    await SecureStore.deleteItemAsync(`${key}.count`);
    await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)));
  },
};

/** Web has no SecureStore; fall back to localStorage (guarded for non-browser contexts). */
export const WebStorageAdapter: SupportedStorage = {
  getItem: (key) => (typeof window === 'undefined' ? null : window.localStorage.getItem(key)),
  setItem: (key, value) => {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
  },
  removeItem: (key) => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
  },
};

// -----------------------------------------------------------------------------
// Client
// -----------------------------------------------------------------------------

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.',
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'missing-anon-key',
  {
    auth: {
      storage: Platform.OS === 'web' ? WebStorageAdapter : ExpoSecureStoreAdapter,
      flowType: 'pkce',
      autoRefreshToken: true,
      persistSession: true,
      // OAuth callbacks are exchanged explicitly by src/services/auth.ts on every
      // platform (via app/auth/callback.tsx), so the client must not race us for the code.
      detectSessionInUrl: false,
    },
  },
);

/**
 * On native, only refresh tokens while the app is foregrounded (Supabase's
 * recommended pattern for React Native). Returns an unsubscribe function.
 */
export function bindAuthAutoRefreshToAppState(): () => void {
  if (Platform.OS === 'web') return () => {};

  const apply = (state: string) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  };
  apply(AppState.currentState ?? 'active');
  const sub = AppState.addEventListener('change', apply);
  return () => sub.remove();
}
