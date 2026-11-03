import { fireEvent, render, screen } from '@testing-library/react-native';

import { DeleteAccountSetting } from '@/components/settings/DeleteAccountSetting';

import { ReportModal } from '../ReportModal';

const mockReport = jest.fn();
const mockBlock = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/hooks/useSafety', () => ({
  useSubmitReport: () => ({ mutate: mockReport, isPending: false, isError: false }),
  useBlockUser: () => ({ mutate: mockBlock, isPending: false }),
  useDeleteAccount: () => ({ mutate: mockDelete, isPending: false, isError: false }),
}));
jest.mock('@/services/supabase', () => ({ supabase: {} }));

beforeEach(() => {
  mockReport.mockReset();
  mockBlock.mockReset();
  mockDelete.mockReset();
});

const subject = { targetType: 'review' as const, targetId: 'r1', targetUserId: 'u2', label: "sam's review", ownerName: 'sam' };

describe('ReportModal', () => {
  it('needs a reason, then sends the report (and optionally blocks)', async () => {
    mockReport.mockImplementation((_input, opts: { onSuccess: () => void }) => opts.onSuccess());
    const onClose = jest.fn();
    await render(<ReportModal subject={subject} onClose={onClose} />);
    const send = screen.getByLabelText('Send Report');
    expect(send.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByText('Hate speech or slurs'));
    await fireEvent.changeText(screen.getByPlaceholderText('Anything that helps us review it'), 'slur in paragraph 2');
    await fireEvent.press(screen.getByLabelText('Also block sam'));
    await fireEvent.press(screen.getByLabelText('Send Report'));
    expect(mockReport).toHaveBeenCalledWith(
      { targetType: 'review', targetId: 'r1', targetUserId: 'u2', reason: 'hate', details: 'slur in paragraph 2' },
      expect.anything(),
    );
    expect(mockBlock).toHaveBeenCalledWith({ userId: 'u2', block: true });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Delete account', () => {
  it('explains what is deleted and only enables Delete Forever after typing your username', async () => {
    await render(<DeleteAccountSetting username="Pan" />);
    await fireEvent.press(screen.getByLabelText('Delete Account'));
    expect(screen.getByText(/your ratings, reviews and drafts/)).toBeTruthy();
    const confirm = () => screen.getByLabelText('Delete Forever');
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Type your username (Pan) to confirm'), 'pa');
    expect(confirm().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Type your username (Pan) to confirm'), 'pan');
    expect(confirm().props.accessibilityState.disabled).toBe(false);
    await fireEvent.press(confirm());
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
