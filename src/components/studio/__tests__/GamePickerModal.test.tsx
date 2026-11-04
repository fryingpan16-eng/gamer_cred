import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { GamePickerModal } from '../GamePickerModal';

jest.mock('@/services/supabase', () => ({ supabase: {}, bindAuthAutoRefreshToAppState: () => () => undefined, isSupabaseConfigured: true }));

const wrap = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const base = { visible: true, title: 'Add game — Slot 1', onClose: jest.fn(), onPick: jest.fn() };

describe('GamePickerModal suggestions (the backlog)', () => {
  it('shows the suggestions list before you search', async () => {
    await wrap(<GamePickerModal {...base} suggestions={{ title: 'Your backlog', gameIds: [], emptyText: 'Your backlog is empty.' }} />);
    expect(screen.getByText('Your backlog is empty.')).toBeTruthy();
    expect(screen.queryByText(/Type at least/)).toBeNull();
  });

  it('without suggestions it asks you to type, as before', async () => {
    await wrap(<GamePickerModal {...base} />);
    expect(screen.getByText(/Type at least/)).toBeTruthy();
  });
});
