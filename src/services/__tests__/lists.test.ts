import { searchLists } from '../lists';

type Call = { table: string; ops: [string, unknown[]][] };
const mockCalls: Call[] = [];

jest.mock('@/services/supabase', () => {
  const builder = (call: Call) => {
    const chain: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'or', 'not', 'order', 'limit', 'in']) {
      chain[op] = (...args: unknown[]) => {
        call.ops.push([op, args]);
        return chain;
      };
    }
    chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => {
        const call: Call = { table, ops: [] };
        mockCalls.push(call);
        return builder(call);
      },
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
});

describe('searchLists', () => {
  it('only searches public lists, by title or description', async () => {
    await searchLists('cozy');
    expect(mockCalls).toHaveLength(1);
    expect(mockCalls[0]!.table).toBe('lists');
    expect(mockCalls[0]!.ops).toContainEqual(['eq', ['is_public', true]]);
    expect(mockCalls[0]!.ops).toContainEqual(['or', ['title.ilike.%cozy%,description.ilike.%cozy%']]);
  });

  it('makes no request for a too-short term', async () => {
    expect(await searchLists('c')).toEqual([]);
    expect(mockCalls).toHaveLength(0);
  });
});
