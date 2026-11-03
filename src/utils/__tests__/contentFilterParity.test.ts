import samples from '../../../supabase/tests/fixtures/objectionable_samples.json';
import { containsObjectionable } from '../contentFilter';

// The database has a backstop filter (migration 000026) tested on the same samples:
// it must never block what the app allows, and both must block the obvious cases.
describe('content filter samples shared with the database', () => {
  it.each(samples.blocked)('blocks %s', (text) => {
    expect(containsObjectionable(text.replace(/_/g, ' '))).toBe(true);
  });

  it.each(samples.allowed)('allows %s', (text) => {
    expect(containsObjectionable(text.replace(/_/g, ' '))).toBe(false);
  });
});
