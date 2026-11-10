import { QueryClient } from '@tanstack/react-query';

import type { IgdbGameResult } from '@/types/igdb';
import { queryKeys } from '@/utils/queryKeys';

import {
  GAME_RECORDS_MAX,
  GAME_RECORDS_MAX_AGE_MS,
  GAME_RECORDS_STORAGE_KEY,
  restoreGameRecords,
  snapshotGameRecords,
  startSavingGameRecords,
} from '../gameRecordStore';

const game = (id: number) => ({ id, name: `Game ${id}` }) as IgdbGameResult;

function memoryStore(initial?: string) {
  const data = new Map<string, string>(initial ? [[GAME_RECORDS_STORAGE_KEY, initial]] : []);
  return {
    data,
    getItem: jest.fn(async (k: string) => data.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => void data.set(k, v)),
  };
}

describe('gameRecordStore (game records saved on the device)', () => {
  it('restores fresh records with their original fetch time; drops old, future and malformed ones', async () => {
    const now = Date.now();
    const store = memoryStore(
      JSON.stringify({
        games: [[now - 1000, game(1)], [now - GAME_RECORDS_MAX_AGE_MS - 1, game(2)], [now + 60_000, game(3)], [now, { id: 'x' }], 'junk'],
      }),
    );
    const qc = new QueryClient();
    expect(await restoreGameRecords(qc, store, now)).toBe(1);
    expect(qc.getQueryData(queryKeys.games.detail(1))).toEqual(game(1));
    expect(qc.getQueryState(queryKeys.games.detail(1))?.dataUpdatedAt).toBe(now - 1000);
    expect(qc.getQueryData(queryKeys.games.detail(2))).toBeUndefined();
  });

  it('never overwrites a record already loaded, and survives broken storage', async () => {
    const qc = new QueryClient();
    qc.setQueryData(queryKeys.games.detail(1), { ...game(1), name: 'Newer' });
    await restoreGameRecords(qc, memoryStore(JSON.stringify({ games: [[Date.now(), game(1)]] })));
    expect(qc.getQueryData<IgdbGameResult>(queryKeys.games.detail(1))?.name).toBe('Newer');
    expect(await restoreGameRecords(qc, memoryStore('{not json'))).toBe(0);
    expect(await restoreGameRecords(qc, { getItem: () => Promise.reject(new Error('full')), setItem: jest.fn() })).toBe(0);
  });

  it('keeps only the newest records, and saves only game records, a moment after they change', async () => {
    jest.useFakeTimers();
    const qc = new QueryClient();
    for (let i = 1; i <= GAME_RECORDS_MAX + 5; i++) qc.setQueryData(queryKeys.games.detail(i), game(i), { updatedAt: i });
    expect(snapshotGameRecords(qc).games).toHaveLength(GAME_RECORDS_MAX);
    expect(snapshotGameRecords(qc).games[0]![1].id).toBe(GAME_RECORDS_MAX + 5);

    const store = memoryStore();
    const stop = startSavingGameRecords(qc, store);
    qc.setQueryData(queryKeys.profiles.detail('u1'), { id: 'u1' });
    jest.advanceTimersByTime(5000);
    expect(store.setItem).not.toHaveBeenCalled();
    qc.setQueryData(queryKeys.games.detail(9999), game(9999));
    qc.setQueryData(queryKeys.games.detail(9998), game(9998));
    jest.advanceTimersByTime(5000);
    expect(store.setItem).toHaveBeenCalledTimes(1);
    stop();
    jest.useRealTimers();
  });
});
