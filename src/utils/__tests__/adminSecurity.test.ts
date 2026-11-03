import { authCodeSchema, describeAdminAction, formatSetupKey, type AdminActivityEntry } from '../adminSecurity';

const entry = (action: string, details: Record<string, unknown> = {}, targetType: string | null = 'list'): AdminActivityEntry => ({
  id: 1,
  createdAt: '2026-11-03T00:00:00Z',
  adminName: 'pan',
  action,
  targetType,
  targetId: 'x',
  details,
});

describe('authCodeSchema', () => {
  it('accepts 6 digits, ignoring spaces', () => {
    expect(authCodeSchema.parse('123 456')).toBe('123456');
    expect(authCodeSchema.safeParse('12345').success).toBe(false);
    expect(authCodeSchema.safeParse('12a456').success).toBe(false);
  });
});

describe('formatSetupKey', () => {
  it('groups the key in fours', () => {
    expect(formatSetupKey('ABCDEFGHIJ')).toBe('ABCD EFGH IJ');
  });
});

describe('describeAdminAction', () => {
  it('reads like a sentence', () => {
    expect(describeAdminAction(entry('list.feature', { title: 'Co-op', rank: 2 }))).toBe('Featured list “Co-op” on Home at #2');
    expect(describeAdminAction(entry('list.unfeature', {}))).toBe('Unfeatured a list');
    expect(describeAdminAction(entry('reports.remove', { reports: 3 }, 'review'))).toBe('Removed a reported review (3 reports)');
    expect(describeAdminAction(entry('reports.dismiss', { reports: 1 }, 'user'))).toBe('Dismissed reports on a player (1 report)');
    expect(describeAdminAction(entry('avatar.approve', {}, 'user'))).toBe('Approved a held profile picture');
    expect(describeAdminAction(entry('something.new'))).toBe('something.new');
  });
});
