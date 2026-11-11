import { isUuid } from '../ids';

describe('isUuid', () => {
  it('accepts UUIDs in either case', () => {
    expect(isUuid('00000000-0000-0000-0000-00000000000a')).toBe(true);
    expect(isUuid('ABCDEF00-1234-5678-9ABC-DEF012345678')).toBe(true);
  });

  it('rejects anything that could change a PostgREST filter', () => {
    expect(isUuid('00000000-0000-0000-0000-00000000000a,status.eq.pending')).toBe(false);
    expect(isUuid('x),or(user_id.neq.0')).toBe(false);
    expect(isUuid('')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(['00000000-0000-0000-0000-00000000000a'])).toBe(false);
  });
});
