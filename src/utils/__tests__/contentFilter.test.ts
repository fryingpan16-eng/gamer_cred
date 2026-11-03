import { containsObjectionable } from '../contentFilter';
import { usernameSchema } from '../authSchemas';
import { listFormSchema } from '../listSchemas';

describe('objectionable-text filter', () => {
  it('catches profanity, including disguised spellings', () => {
    for (const bad of ['what a piece of shit', 'fuuuuck', 'sh1t game', 'you are a b1tch', 'FUCK THIS']) {
      expect(containsObjectionable(bad)).toBe(true);
    }
  });

  it("doesn't flag ordinary game talk and titles", () => {
    for (const ok of [
      "Assassin's Creed Valhalla",
      'Cocktail party mode is great',
      'Scunthorpe United FC',
      'The Witcher 3: Wild Hunt',
      'Hell Let Loose',
      'Shoot em up classics',
      'Dickens would love this story',
      'Grass-type Pokemon only',
      'Cockpit view in Microsoft Flight Simulator',
      'Dick Grayson is the best Robin',
      'Shiitake mushrooms in Cooking Mama',
      'Pussycat dolls cameo',
      'Peacock streaming',
      '',
    ]) {
      expect(containsObjectionable(ok)).toBe(false);
    }
  });

  it('is enforced by the schemas for public text', () => {
    expect(usernameSchema.safeParse('cool_gamer').success).toBe(true);
    expect(usernameSchema.safeParse('shit_lord').success).toBe(false);
    const list = (title: string, description = '') => listFormSchema.safeParse({ title, description, isRanked: false, isPublic: true }).success;
    expect(list('Best RPGs')).toBe(true);
    expect(list('fucking awesome games')).toBe(false);
    expect(list('Best RPGs', 'all bullsh1t')).toBe(false);
  });
});
