import { activeTabName } from '../RetroGamingPCBottomNav';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() }, useSegments: () => [] }));

describe('activeTabName', () => {
  it('highlights the tab being shown', () => {
    expect(activeTabName(['(tabs)'])).toBe('index');
    expect(activeTabName(['(tabs)', 'search'])).toBe('search');
    expect(activeTabName(['(tabs)', 'profile'])).toBe('profile');
  });
  it('highlights nothing on pushed pages', () => {
    expect(activeTabName(['game', '[id]'])).toBeNull();
    expect(activeTabName(['settings'])).toBeNull();
  });
});
