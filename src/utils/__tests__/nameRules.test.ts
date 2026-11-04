import samples from '../../../supabase/tests/fixtures/name_samples.json';
import { isDisplayNameFormatOk, isPermanentNameFormatOk, normalizeDisplayName, shownName } from '../nameRules';

// The same samples run against the database in supabase/tests/names_sql_test.ts.
describe('name format rules match the database', () => {
  it.each(samples.permanentFormat.ok)('permanent ok: %s', (name) => expect(isPermanentNameFormatOk(name)).toBe(true));
  it.each(samples.permanentFormat.bad)('permanent rejected: %s', (name) => expect(isPermanentNameFormatOk(name)).toBe(false));
  it.each(samples.displayFormat.ok)('display ok: %s', (name) => expect(isDisplayNameFormatOk(name.normalize('NFC'))).toBe(true));
  it.each(samples.displayFormat.bad)('display rejected: %s', (name) => expect(isDisplayNameFormatOk(name.normalize('NFC'))).toBe(false));
});

describe('display names', () => {
  it('trims, collapses spaces and composes accents', () => {
    expect(normalizeDisplayName('  Café   Gamer ')).toBe('Café Gamer');
  });

  it('falls back to the permanent name', () => {
    expect(shownName('gordon', null)).toBe('gordon');
    expect(shownName('gordon', '')).toBe('gordon');
    expect(shownName('gordon', 'Gordon F.')).toBe('Gordon F.');
  });
});
