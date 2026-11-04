import { remasterLine } from '@/components/search/GameResultCard';

describe('remasterLine', () => {
  it('is empty for games with no remaster', () => {
    expect(remasterLine({ remasterCount: 0, remasterYears: [] })).toBeNull();
  });
  it('lists the years, capped at three', () => {
    expect(remasterLine({ remasterCount: 1, remasterYears: [2018] })).toBe('Also remastered · 2018');
    expect(remasterLine({ remasterCount: 5, remasterYears: [2005, 2011, 2018, 2020, 2023] })).toBe('Also remastered · 2005, 2011, 2018 +2');
  });
  it('falls back to a count when no year is known', () => {
    expect(remasterLine({ remasterCount: 1, remasterYears: [] })).toBe('Also remastered');
    expect(remasterLine({ remasterCount: 2, remasterYears: [] })).toBe('Also remastered (2 versions)');
  });
});
