import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '@/hooks/useAuth';

import { MoreMenu } from '../MoreMenu';

jest.mock('@/services/supabase', () => ({ supabase: {}, bindAuthAutoRefreshToAppState: () => () => undefined, isSupabaseConfigured: true }));

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const subject = { targetType: 'user', targetId: 'u1', targetUserId: 'u1', label: 'sam', ownerName: 'sam' } as const;

describe('MoreMenu (⋯)', () => {
  beforeEach(() => useAuthStore.setState({ isGuest: false }));

  it('lists plain actions, then Report, then red ones; picking one closes the menu and runs it', async () => {
    const block = jest.fn();
    await wrap(<MoreMenu label="sam" report={subject} actions={[{ label: 'Block sam', variant: 'danger', onPress: block }, { label: 'Share', onPress: jest.fn() }]} />);
    await fireEvent.press(screen.getByLabelText('More options for sam'));
    const labels = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel ?? '').filter((l: string) => /Share|Report sam|Block sam/.test(l));
    expect(labels.map((l: string) => l.replace(/^⚠\s*/, ''))).toEqual(['Share', '⚑ Report sam', 'Block sam']);
    await fireEvent.press(screen.getByLabelText(/Block sam/));
    expect(block).toHaveBeenCalled();
  });

  it('shows nothing to a guest when Report is the only option', async () => {
    useAuthStore.setState({ isGuest: true });
    await wrap(<MoreMenu label="sam" report={subject} />);
    expect(screen.queryByLabelText('More options for sam')).toBeNull();
  });
});
