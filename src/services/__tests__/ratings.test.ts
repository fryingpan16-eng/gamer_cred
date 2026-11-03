/**
 * Quick-rating service against a recorded Supabase client: one batched read,
 * upsert on the one-per-game key, and never a write to public.reviews.
 */
import { clearGameRating, fetchMyRatings, rateGame, RatingError } from '../ratings';
import { storedFromStars } from '@/utils/quickRating';

type Call = { table: string; ops: [string, unknown[]][] };
const mockCalls: Call[] = [];
let mockNextResult: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock('@/services/supabase', () => {
  const builder = (call: Call) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'in', 'upsert', 'insert', 'update', 'delete', 'single', 'maybeSingle']) {
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
      rpc: () => {
        throw new Error('ratings never call RPCs');
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockNextResult = { data: [], error: null };
});

const ME = 'user-1';

describe('fetchMyRatings (batched)', () => {
  it('loads every visible game in ONE query, de-duplicated and sorted', async () => {
    mockNextResult = {
      data: [
        { game_id: 5, rating: 89, rating_input_scale: 'stars', rating_input: '4' },
        { game_id: 2, rating: 92, rating_input_scale: 'tier', rating_input: 'A+' },
      ],
      error: null,
    };
    const ratings = await fetchMyRatings(ME, [5, 2, 9, 5]);
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0]!.table).toBe('game_ratings');
    expect(mockCalls[0]!.ops).toContainEqual(['eq', ['user_id', ME]]);
    expect(mockCalls[0]!.ops).toContainEqual(['in', ['game_id', [2, 5, 9]]]);
    expect(ratings).toEqual({
      5: { numeric: 89, inputScale: 'stars', input: '4' },
      2: { numeric: 92, inputScale: 'tier', input: 'A+' },
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
    await rateGame(ME, 3, storedFromStars(4));
    const upsert = mockCalls[0]!.ops.find(([op]) => op === 'upsert')!;
    expect(upsert[1][0]).toEqual({ user_id: ME, game_id: 3, rating: storedFromStars(4).numeric, rating_input_scale: 'stars', rating_input: '4' });
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
    await rateGame(ME, 3, storedFromStars(2));
    await rateGame(ME, 3, storedFromStars(5));
    mockNextResult = { data: null, error: null };
    await clearGameRating(ME, 3);
    mockNextResult = { data: [], error: null };
    await fetchMyRatings(ME, [3]);
    expect(mockCalls.map((c) => c.table)).toEqual(['game_ratings', 'game_ratings', 'game_ratings', 'game_ratings']);
  });
});
