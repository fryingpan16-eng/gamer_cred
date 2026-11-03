import { fireEvent, render, screen } from '@testing-library/react-native';

import HomeScreen from '../../../../app/(tabs)/index';

const mockParams: { tab?: string } = {};
const mockSetParams = jest.fn();
/** Renders a stub's name (called at render time: mock factories run before imports). */
function mockLabel(label: string) {
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return <Text>{label}</Text>;
}

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: (p: { tab?: string }) => mockSetParams(p) },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual<object>('@tanstack/react-query'),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock('@/services/supabase', () => ({ supabase: {} }));
// Each tab's content is stubbed: this test is about the top tab bar.
jest.mock('@/components/home/HomeFeed', () => ({
  HomeFeed: ({ scope, header }: { scope: string; header?: unknown }) => {
    const { Text: T, View: V } = jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <V>
        <T>{`feed:${scope}`}</T>
        {header as never}
      </V>
    );
  },
}));
jest.mock('@/components/home/TrendingGames', () => ({ TrendingGames: () => mockLabel('trending-games') }));
jest.mock('@/components/home/TrendingPosts', () => ({ TrendingPosts: () => mockLabel('trending-posts') }));
jest.mock('@/components/lists/HomeLists', () => ({
  FeaturedListsPanel: () => mockLabel('curated-lists'),
  YourListsPanel: () => mockLabel('your-lists'),
  ListBrowser: () => mockLabel('list-browser'),
}));

beforeEach(() => {
  delete mockParams.tab;
  mockSetParams.mockClear();
});

describe('Home tab bar', () => {
  it('defaults to Community: trending games, trending posts, then the community feed', async () => {
    await render(<HomeScreen />);
    for (const t of ['trending-games', 'trending-posts', 'feed:community']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.queryByText('feed:friends')).toBeNull();
    expect(screen.queryByText('curated-lists')).toBeNull();
  });

  it('?tab=friends shows only the friends feed; ?tab=lists shows curated, yours and the browser', async () => {
    mockParams.tab = 'friends';
    const { rerender } = await render(<HomeScreen />);
    expect(screen.getByText('feed:friends')).toBeTruthy();
    expect(screen.queryByText('trending-games')).toBeNull();
    mockParams.tab = 'lists';
    await rerender(<HomeScreen />);
    for (const t of ['curated-lists', 'your-lists', 'list-browser']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.queryByText('feed:friends')).toBeNull();
  });

  it('tapping a tab updates the route param', async () => {
    await render(<HomeScreen />);
    await fireEvent.press(screen.getByText('Lists'));
    expect(mockSetParams).toHaveBeenCalledWith({ tab: 'lists' });
  });
});
