import { DEFAULT_SMART_RULE, describeRequirements, describeSmartRule, parseSmartRule, smartRuleSchema } from '../smartLists';

describe('smartRuleSchema', () => {
  it('accepts the default rule', () => {
    expect(smartRuleSchema.safeParse(DEFAULT_SMART_RULE).success).toBe(true);
  });

  it('needs a type, a sane limit and an ordered year range', () => {
    expect(smartRuleSchema.safeParse({ ...DEFAULT_SMART_RULE, entryTypes: [] }).success).toBe(false);
    expect(smartRuleSchema.safeParse({ ...DEFAULT_SMART_RULE, limit: 501 }).success).toBe(false);
    expect(smartRuleSchema.safeParse({ ...DEFAULT_SMART_RULE, yearFrom: 2010, yearTo: 2000 }).success).toBe(false);
    expect(smartRuleSchema.safeParse({ ...DEFAULT_SMART_RULE, genres: ['Not a genre'] }).success).toBe(false);
  });

  it('treats a malformed stored rule as not smart', () => {
    expect(parseSmartRule(null)).toBeNull();
    expect(parseSmartRule({ entryTypes: 'game' })).toBeNull();
    expect(parseSmartRule(DEFAULT_SMART_RULE)).toEqual(DEFAULT_SMART_RULE);
    // Rules saved before likes existed rank by average.
    const { rankBy: _omit, ...old } = DEFAULT_SMART_RULE;
    expect(parseSmartRule(old)?.rankBy).toBe('average');
  });
});

describe('describeSmartRule', () => {
  it('reads like a title', () => {
    expect(describeSmartRule(DEFAULT_SMART_RULE)).toBe('Top 500 games');
    expect(describeSmartRule({ ...DEFAULT_SMART_RULE, entryTypes: ['expansion'] })).toBe('Top 500 expansions');
    expect(
      describeSmartRule({
        ...DEFAULT_SMART_RULE,
        limit: 100,
        genres: ['Role-playing (RPG)'],
        tiers: ['S'],
        yearFrom: 2000,
        yearTo: 2009,
        platformId: 130,
      }),
    ).toBe('Top 100 RPG games · S tier · the 2000s · played on Switch');
    expect(describeSmartRule({ ...DEFAULT_SMART_RULE, yearFrom: 2015, yearTo: null })).toBe('Top 500 games · 2015 onward');
    expect(describeSmartRule({ ...DEFAULT_SMART_RULE, rankBy: 'likes', entryTypes: ['expansion'], limit: 100 })).toBe(
      'Most liked 100 expansions',
    );
  });
});

describe('describeRequirements', () => {
  it('explains the rating bar', () => {
    expect(describeRequirements({ game: 12 })).toBe('A game needs 12+ ratings to qualify.');
    expect(describeRequirements({ game: 12, expansion: 4 })).toBe('Needs 12+ ratings (games) · 4+ ratings (expansions) to qualify.');
    expect(describeRequirements({})).toBe('');
  });
});
