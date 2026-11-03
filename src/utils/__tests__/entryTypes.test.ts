import { ENTRY_TYPE_LABELS, isAddOnEntry, isCollectionEntry, isRankableEntry, type EntryType } from '@/types/igdb';

const ALL: EntryType[] = ['game', 'remake', 'collection', 'expansion', 'dlc'];

describe('catalogue entry types', () => {
  it('only games and remakes count toward top-game lists', () => {
    expect(ALL.filter(isRankableEntry)).toEqual(['game', 'remake']);
  });

  it('collections, expansions and DLC have their own categories', () => {
    expect(ALL.filter(isCollectionEntry)).toEqual(['collection']);
    expect(ALL.filter(isAddOnEntry)).toEqual(['expansion', 'dlc']);
  });

  it('every entry type has a label', () => {
    for (const t of ALL) expect(ENTRY_TYPE_LABELS[t].length).toBeGreaterThan(0);
  });
});
