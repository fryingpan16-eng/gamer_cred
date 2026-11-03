import { act, render, screen } from '@testing-library/react-native';

import { RetroGamingPCSaveStatus, saveStatusOf } from '../RetroGamingPCSaveStatus';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('RetroGamingPCSaveStatus', () => {
  it('shows Saving… while pending, then ✓ Saved briefly', async () => {
    const { rerender } = await render(<RetroGamingPCSaveStatus pending savedAt={null} />);
    expect(screen.getByText('Saving…')).toBeTruthy();

    await rerender(<RetroGamingPCSaveStatus pending={false} savedAt={1000} />);
    expect(screen.getByText('✓ Saved')).toBeTruthy();

    await act(() => jest.advanceTimersByTime(2600));
    expect(screen.queryByText('✓ Saved')).toBeNull();

    // the next save shows it again
    await rerender(<RetroGamingPCSaveStatus pending={false} savedAt={2000} />);
    expect(screen.getByText('✓ Saved')).toBeTruthy();
  });

  it('shows nothing before any save or after a failure', async () => {
    await render(<RetroGamingPCSaveStatus {...saveStatusOf({ isPending: false, isSuccess: false, submittedAt: 5 })} />);
    expect(screen.queryByText('✓ Saved')).toBeNull();
    expect(screen.queryByText('Saving…')).toBeNull();
  });
});
