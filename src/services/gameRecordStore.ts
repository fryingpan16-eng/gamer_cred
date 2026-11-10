/**
 * Game records (title, cover, platforms…) saved on THIS device, so covers show
 * at once when the app opens instead of waiting for igdb-proxy. Only public
 * IGDB data is stored (nothing about the player), so it's kept across sign-outs.
 * Each device has its own copy; nothing here touches the server or other players.
 *
 * Restored records keep the time they were fetched, so they go stale on the
 * usual schedule (useGameLookup refreshes stale ones in the background).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryClient } from '@tanstack/react-query';

import type { IgdbGameResult } from '@/types/igdb';
import { queryKeys } from '@/utils/queryKeys';

/** Bump when IgdbGameResult changes shape: older saves are then ignored. */
export const GAME_RECORDS_STORAGE_KEY = 'gamercred.gameRecords.v1';
/** Newest N games kept (~0.5 MB): well inside phone and browser storage limits. */
export const GAME_RECORDS_MAX = 1000;
/** Matches the proxy's per-game TTL: older saves are dropped, not shown. */
export const GAME_RECORDS_MAX_AGE_MS = 7 * 24 * 60 * 60_000;
const SAVE_DELAY_MS = 3000;

type KeyValueStore = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
type Saved = { games: [savedAt: number, game: IgdbGameResult][] };

const isGame = (g: unknown): g is IgdbGameResult =>
  typeof g === 'object' && g !== null && Number.isSafeInteger((g as { id?: unknown }).id) && typeof (g as { name?: unknown }).name === 'string';

/** Puts saved records into the query cache (never over a record that's already there). Returns how many. */
export async function restoreGameRecords(queryClient: QueryClient, storage: KeyValueStore = AsyncStorage, now = Date.now()): Promise<number> {
  let raw: string | null;
  try {
    raw = await storage.getItem(GAME_RECORDS_STORAGE_KEY);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  let saved: Saved;
  try {
    saved = JSON.parse(raw) as Saved;
  } catch {
    return 0;
  }
  if (!Array.isArray(saved?.games)) return 0;
  let restored = 0;
  for (const entry of saved.games) {
    if (!Array.isArray(entry)) continue;
    const [savedAt, game] = entry;
    if (typeof savedAt !== 'number' || now - savedAt > GAME_RECORDS_MAX_AGE_MS || savedAt > now || !isGame(game)) continue;
    const key = queryKeys.games.detail(game.id);
    if (queryClient.getQueryData(key) !== undefined) continue;
    queryClient.setQueryData(key, game, { updatedAt: savedAt });
    restored += 1;
  }
  return restored;
}

/** The newest GAME_RECORDS_MAX game records in the cache, as saved. */
export function snapshotGameRecords(queryClient: QueryClient): Saved {
  const games = queryClient
    .getQueryCache()
    .findAll({ queryKey: queryKeys.games.detailAll() })
    .flatMap((q) => (isGame(q.state.data) ? [[q.state.dataUpdatedAt, q.state.data] as [number, IgdbGameResult]] : []))
    .sort((a, b) => b[0] - a[0])
    .slice(0, GAME_RECORDS_MAX);
  return { games };
}

/** Saves game records a few seconds after they change. Returns a stop function. */
export function startSavingGameRecords(queryClient: QueryClient, storage: KeyValueStore = AsyncStorage): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const prefix = `${JSON.stringify(queryKeys.games.detailAll()).slice(0, -1)},`;
  const save = () => {
    timer = null;
    storage.setItem(GAME_RECORDS_STORAGE_KEY, JSON.stringify(snapshotGameRecords(queryClient))).catch(() => undefined);
  };
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (!event.query.queryHash.startsWith(prefix)) return;
    timer ??= setTimeout(save, SAVE_DELAY_MS);
  });
  return () => {
    unsubscribe();
    if (timer) clearTimeout(timer);
  };
}
