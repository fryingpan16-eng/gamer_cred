import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import { useAuthStore } from '@/hooks/useAuth';
import type { ReviewCardData } from '@/services/reviewBrowser';

import { ReviewCard } from '../ReviewCard';

jest.mock('@/services/supabase', () => ({ supabase: {}, bindAuthAutoRefreshToAppState: () => () => undefined, isSupabaseConfigured: true }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));

const review: ReviewCardData = {
  id: 'r1',
  userId: 'u-other',
  gameId: 7,
  author: { id: 'u-other', username: 'other', avatar_url: null },
  rating: { numeric: 90, inputScale: 'numeric', input: '90' },
  platformId: null,
  content: 'Great game',
  date: '2026-11-01T00:00:00Z',
};

const wrap = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({ isGuest: false });
});

describe('ReviewCard (the one review preview)', () => {
  it('opens the full review, or the author profile from their name', async () => {
    await wrap(<ReviewCard review={review} viewerId="u-me" like={{ liked: false, count: null }} />);
    await fireEvent.press(screen.getByLabelText("other's review. Open review"));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/review/[id]', params: { id: 'r1' } });
    await fireEvent.press(screen.getByText('other'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/user/[id]', params: { id: 'u-other' } });
  });

  it("shows ♥ Like on someone else's review", async () => {
    await wrap(<ReviewCard review={review} viewerId="u-me" like={{ liked: true, count: null }} />);
    expect(screen.getByLabelText('Unlike this review')).toBeTruthy();
  });

  it('on your own review: no ♥ button, but your private like count', async () => {
    await wrap(<ReviewCard review={{ ...review, userId: 'u-me' }} viewerId="u-me" like={{ liked: false, count: 3 }} />);
    expect(screen.queryByLabelText(/Like this review/)).toBeNull();
    expect(screen.getByText(/only you see this/)).toBeTruthy();
  });

  it('guests can read but not like', async () => {
    useAuthStore.setState({ isGuest: true });
    await wrap(<ReviewCard review={review} viewerId={null} like={{ liked: false, count: null }} />);
    expect(screen.getByText('Great game')).toBeTruthy();
    expect(screen.queryByLabelText('Like this review')).toBeNull();
  });
});
