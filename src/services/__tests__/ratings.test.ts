/**
 * Quick-rating service against a recorded Supabase client: one batched read,
 * upsert on the one-per-game key, and never a write to public.reviews. The
 * profile list adds one batched replay-count RPC (migration 000040).
 */
import { clearGameRating, fetchMyRatings, fetchUserRatings, rateGame, RatingError } from '../ratings';
import { storedFromStars } from '@/utils/quickRating';

const entry = (stars: number, platformId: number | null = 8) => ({ ...storedFromStars(stars), platformId });

type Call = { table: string; ops: [string, unknown[]][] };
const mockCalls: Call[] = [];
let mockNextResult: { data: unknown; error: unknown } = { data: [], error: null };
const mockRpcCalls: [string, unknown][] = [];
let mockRpcResult: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock('@/services/supabase', () => {
  const builder = (call: Call) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'in', 'upsert', 'insert', 'update', 'delete', 'single', 'maybeSingle', 'order', 'limit']) {
      chain[op] = (...args: unknown[]) => {
        call.ops.push([op, args]);
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown) => resolve(mockNextResult);
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => {
        const call: Call = { table, ops: [] };
        mockCalls.push(call);
        return builder(call);
      },
      rpc: (name: string, args: unknown) => {
        mockRpcCalls.push([name, args]);
        return Promise.resolve(mockRpcResult);
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResult = { data: [], error: null };
  mockRpcCalls.length = 0;
  mockRpcResult = { data: [], error: null };
});

const ME = 'user-1';

describe('fetchMyRatings (batched)', () => {
  it('loads every visible game in ONE query, de-duplicated and sorted', async () => {
    mockNextResult = {
      data: [
        { game_id: 5, rating: 89, rating_input_scale: 'stars', rating_input: '4', platform_id: 8 },
        { game_id: 2, rating: 92, rating_input_scale: 'tier', rating_input: 'A+', platform_id: null },
      ],
      error: null,
    };
    const ratings = await fetchMyRatings(ME, [5, 2, 9, 5]);
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0]!.table).toBe('game_ratings');
    expect(mockCalls[0]!.ops).toContainEqual(['eq', ['user_id', ME]]);
    expect(mockCalls[0]!.ops).toContainEqual(['in', ['game_id', [2, 5, 9]]]);
    expect(ratings).toEqual({
      5: { numeric: 89, inputScale: 'stars', input: '4', platformId: 8 },
      2: { numeric: 92, inputScale: 'tier', input: 'A+', platformId: null },
    }); // 9 is unrated → absent
  });

  it('makes no request for an empty list', async () => {
    expect(await fetchMyRatings(ME, [])).toEqual({});
    expect(mockCalls).toHaveLength(0);
  });
});

describe('rateGame / clearGameRating', () => {
  it('set and change are an upsert on the one-per-game key', async () => {
    mockNextResult = { data: { user_id: ME, game_id: 3 }, error: null };
    await rateGame(ME, 3, entry(4, 167));
    const upsert = mockCalls[0]!.ops.find(([op]) => op === 'upsert')!;
    expect(upsert[1][0]).toEqual({
      user_id: ME,
      game_id: 3,
      rating: storedFromStars(4).numeric,
      rating_input_scale: 'stars',
      rating_input: '4',
      platform_id: 167,
    });
    expect(upsert[1][1]).toEqual({ onConflict: 'user_id,game_id' });
  });

  it('clear deletes only my row for that game', async () => {
    mockNextResult = { data: null, error: null };
    await clearGameRating(ME, 3);
    expect(mockCalls[0]!.ops).toEqual([
      ['delete', []],
      ['eq', ['user_id', ME]],
      ['eq', ['game_id', 3]],
    ]);
  });

  it('explains when a published review needs the score', async () => {
    mockNextResult = { data: null, error: { code: 'GR001', message: 'This game has a published review, which needs a score.', hint: 'Delete the review first.' } };
    await expect(clearGameRating(ME, 3)).rejects.toEqual(
      new RatingError('This game has a published review, which needs a score. Delete the review first.', 'GR001'),
    );
  });

  it('quick rating never creates, publishes or touches a review', async () => {
    mockNextResult = { data: { user_id: ME, game_id: 3 }, error: null };
    await rateGame(ME, 3, entry(2));
    await rateGame(ME, 3, entry(5));
    mockNextResult = { data: null, error: null };
    await clearGameRating(ME, 3);
    mockNextResult = { data: [], error: null };
    await fetchMyRatings(ME, [3]);
    expect(mockCalls.map((c) => c.table)).toEqual(['game_ratings', 'game_ratings', 'game_ratings', 'game_ratings']);
  });
});

describe('fetchUserRatings (public profile list)', () => {
  it('one query: that player, newest first, with the total count, plus one batched replay count', async () => {
    mockNextResult = {
      data: [
        { game_id: 7, rating: 60, rating_input_scale: 'numeric', rating_input: '60', platform_id: 130, updated_at: '2026-11-01T00:00:00Z' },
        { game_id: 9, rating: 80, rating_input_scale: 'numeric', rating_input: '80', platform_id: null, updated_at: '2026-10-01T00:00:00Z' },
      ],
      error: null,
      count: 31,
    } as never;
    mockRpcResult = { data: [{ game_id: 9, replays: 2 }], error: null };
    const page = await fetchUserRatings('someone-else', 24);
    expect(mockRpcCalls).toEqual([['replay_counts', { p_user_id: 'someone-else', p_game_ids: [7, 9] }]]);
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0]!.table).toBe('game_ratings');
    expect(mockCalls[0]!.ops).toContainEqual(['eq', ['user_id', 'someone-else']]);
    expect(mockCalls[0]!.ops).toContainEqual(['order', ['updated_at', { ascending: false }]]);
    expect(mockCalls[0]!.ops).toContainEqual(['limit', [24]]);
    expect(page).toEqual({
      ratings: [
        { numeric: 60, inputScale: 'numeric', input: '60', platformId: 130, gameId: 7, ratedAt: '2026-11-01T00:00:00Z', replays: 0 },
        { numeric: 80, inputScale: 'numeric', input: '80', platformId: null, gameId: 9, ratedAt: '2026-10-01T00:00:00Z', replays: 2 },
      ],
      total: 31,
    });
  });
});
