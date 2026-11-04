import { render, screen } from '@testing-library/react-native';

import { DEFAULT_SMART_RULE } from '@/utils/smartLists';

import { ListEditorModal } from '../ListEditorModal';

jest.mock('@/services/supabase', () => ({ supabase: {}, bindAuthAutoRefreshToAppState: () => () => undefined, isSupabaseConfigured: true }));

const noop = () => undefined;
const base = { visible: true, saving: false, error: null, onSave: noop, onClose: noop };

describe('ListEditorModal admin-only options', () => {
  it('non-admins never see the smart list option on a new list', async () => {
    await render(<ListEditorModal {...base} />);
    expect(screen.queryByText('Smart list (admin)')).toBeNull();
  });

  it('admins do', async () => {
    await render(<ListEditorModal {...base} allowSmart />);
    expect(screen.getByText('Smart list (admin)')).toBeTruthy();
  });

  it('a non-admin editing an existing smart list sees the rule read-only, not the rule builder', async () => {
    const initial = { title: 'Top 500 games', description: '', isRanked: true, isPublic: true, smartRule: DEFAULT_SMART_RULE };
    await render(<ListEditorModal {...base} initial={initial} />);
    expect(screen.getByText(/Fills itself: Top 500 games/)).toBeTruthy();
    expect(screen.queryByText('Rank by')).toBeNull();
  });
});
