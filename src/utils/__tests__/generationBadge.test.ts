import { generationBadgeView } from '@/utils/generationBadge';

const base = { generation: '6', releaseYear: 2001, remakeOf: null, remasteredFor: [], listId: 'list-6', rank: null };

describe('generationBadgeView', () => {
  it('a console game: "Gen 6", no year on the badge, rank on the corner', () => {
    const view = generationBadgeView({ ...base, rank: 12 })!;
    expect([view.label, view.subLabel, view.rankText]).toEqual(['Gen 6', null, '#12']);
    expect(view.title).toBe('6th Generation (1998–2013)');
    expect(view.lines).toEqual(['First released in 2001.', '#12 in Top 250: 6th Generation (1998–2013).']);
    expect(view.accessibilityLabel).toBe('6th Generation (1998–2013), number 12 in the Top 250: 6th Generation (1998–2013)');
  });

  it('PC: the year under the label; remasters on later generations', () => {
    const view = generationBadgeView({ ...base, generation: 'pc', releaseYear: 2016, remasteredFor: ['8', '9'] })!;
    expect([view.label, view.subLabel, view.rankText]).toEqual(['PC', '2016', null]);
    expect(view.lines).toEqual(['First released in 2016.', 'Remastered for Gen 8 and Gen 9.', 'Not in the Top 250: PC & computers yet.']);
  });

  it('a remake names the generation of the game it remakes', () => {
    expect(generationBadgeView({ ...base, generation: '9', remakeOf: '1' })!.lines).toContain('Remake of a Gen 1 game.');
    expect(generationBadgeView({ ...base, generation: '8', remakeOf: 'arcade' })!.lines).toContain('Remake of an Arcade game.');
  });

  it('an unknown group draws nothing', () => {
    expect(generationBadgeView({ ...base, generation: 'vr' })).toBeNull();
  });
});
