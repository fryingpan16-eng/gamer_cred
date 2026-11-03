import { applyListItemAction } from '@/hooks/useLists';
import { listSearchPattern } from '@/services/lists';
import { listFormSchema } from '@/utils/listSchemas';

jest.mock('@/services/supabase', () => ({ supabase: {} }));

describe('list form', () => {
  it('trims and requires a title; description optional; limits enforced', () => {
    expect(listFormSchema.parse({ title: '  Top 10  ', description: ' ', isRanked: true, isPublic: false })).toEqual({
      title: 'Top 10',
      description: '',
      isRanked: true,
      isPublic: false,
    });
    expect(listFormSchema.safeParse({ title: '   ', description: '', isRanked: false, isPublic: true }).success).toBe(false);
    expect(listFormSchema.safeParse({ title: 'x'.repeat(81), description: '', isRanked: false, isPublic: true }).success).toBe(false);
    expect(listFormSchema.safeParse({ title: 'ok', description: 'y'.repeat(1001), isRanked: false, isPublic: true }).success).toBe(false);
  });
});

describe('list order (optimistic updates mirror move_list_item)', () => {
  it('add appends once, remove drops, move takes a 1-based position (clamped)', () => {
    expect(applyListItemAction([1, 2], { action: 'add', gameId: 3 })).toEqual([1, 2, 3]);
    expect(applyListItemAction([1, 2], { action: 'add', gameId: 2 })).toEqual([1, 2]);
    expect(applyListItemAction([1, 2, 3], { action: 'remove', gameId: 2 })).toEqual([1, 3]);
    expect(applyListItemAction([1, 2, 3, 4], { action: 'move', gameId: 4, to: 1 })).toEqual([4, 1, 2, 3]);
    expect(applyListItemAction([1, 2, 3], { action: 'move', gameId: 1, to: 2 })).toEqual([2, 1, 3]); // ▼
    expect(applyListItemAction([1, 2, 3], { action: 'move', gameId: 3, to: 2 })).toEqual([1, 3, 2]); // ▲
    expect(applyListItemAction([1, 2, 3], { action: 'move', gameId: 1, to: 99 })).toEqual([2, 3, 1]);
  });
});

describe('list search input', () => {
  it('needs 2+ characters and strips characters that would break the filter', () => {
    expect(listSearchPattern('a')).toBeNull();
    expect(listSearchPattern('  co-op  ')).toBe('%co-op%');
    expect(listSearchPattern('best (2004), ever*')).toBe('%best 2004 ever%');
    expect(listSearchPattern('%%')).toBeNull();
  });
});
