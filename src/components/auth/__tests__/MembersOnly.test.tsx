import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useAuthStore } from '@/hooks/useAuth';

import { MembersOnly } from '../MembersOnly';

jest.mock('@/services/supabase', () => ({ supabase: { auth: {} }, bindAuthAutoRefreshToAppState: () => () => undefined, isSupabaseConfigured: true }));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

describe('MembersOnly', () => {
  it('shows the content to members', async () => {
    useAuthStore.setState({ isGuest: false });
    await render(
      <MembersOnly feature="rate games">
        <Text>Rate it</Text>
      </MembersOnly>,
    );
    expect(screen.getByText('Rate it')).toBeTruthy();
  });

  it('shows guests the join prompt instead', async () => {
    useAuthStore.setState({ isGuest: true });
    await render(
      <MembersOnly feature="rate games">
        <Text>Rate it</Text>
      </MembersOnly>,
    );
    expect(screen.queryByText('Rate it')).toBeNull();
    expect(screen.getByText('Create Account')).toBeTruthy();
  });

  it('can hide for guests', async () => {
    useAuthStore.setState({ isGuest: true });
    await render(
      <MembersOnly feature="add friends" fallback={null}>
        <Text>Add friend</Text>
      </MembersOnly>,
    );
    expect(screen.queryByText('Add friend')).toBeNull();
    expect(screen.queryByText('Create Account')).toBeNull();
  });
});
