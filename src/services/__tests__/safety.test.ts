import { adminDeleteUser, deleteMyAccount, SafetyError, submitReport } from '../safety';

const mockInvoke = jest.fn();
const mockInsert = jest.fn();

jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: (table: string) => ({ insert: (row: unknown) => mockInsert(table, row) }),
  },
}));

beforeEach(() => {
  mockInvoke.mockReset();
  mockInsert.mockReset();
});

describe('account deletion', () => {
  it('calls the account function and succeeds on a success envelope', async () => {
    mockInvoke.mockResolvedValue({ data: { success: true, data: { deleted: 'me' } }, error: null });
    await deleteMyAccount();
    expect(mockInvoke).toHaveBeenCalledWith('account', { body: { action: 'delete_self' } });
    await adminDeleteUser('u2');
    expect(mockInvoke).toHaveBeenLastCalledWith('account', { body: { action: 'admin_delete_user', user_id: 'u2' } });
  });

  it('surfaces a failure instead of pretending the account is gone', async () => {
    mockInvoke.mockResolvedValue({ data: { success: false, error: 'Nope' }, error: null });
    await expect(deleteMyAccount()).rejects.toEqual(new SafetyError('Nope', null));
  });
});

describe('reports', () => {
  it('files the report as the signed-in user, trimming empty details to null', async () => {
    mockInsert.mockResolvedValue({ error: null });
    await submitReport('me', { targetType: 'list', targetId: 'l1', targetUserId: 'u2', reason: 'spam', details: '   ' });
    expect(mockInsert).toHaveBeenCalledWith('content_reports', {
      reporter_id: 'me',
      target_type: 'list',
      target_id: 'l1',
      target_user_id: 'u2',
      reason: 'spam',
      details: null,
    });
  });

  it('explains a duplicate report kindly', async () => {
    mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });
    await expect(submitReport('me', { targetType: 'user', targetId: 'u2', targetUserId: 'u2', reason: 'spam', details: '' })).rejects.toThrow(
      /already reported/,
    );
  });
});
