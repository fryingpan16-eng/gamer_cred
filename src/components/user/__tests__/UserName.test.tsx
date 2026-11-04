import { render, screen } from '@testing-library/react-native';

import { OFFICIAL_LABEL, UserName } from '../UserName';

type Name = { id: string; username: string; displayName: string | null; isOfficial: boolean } | null | undefined;
let mockName: Name;
jest.mock('@/hooks/useNames', () => ({ useProfileName: () => ({ data: mockName }) }));

describe('UserName', () => {
  it('shows the permanent name while names load, with no handle or badge', async () => {
    mockName = undefined;
    await render(<UserName userId="u1" username="gordon" />);
    expect(screen.getByText('gordon')).toBeTruthy();
    expect(screen.queryByText(/@gordon/)).toBeNull();
    expect(screen.queryByLabelText(OFFICIAL_LABEL)).toBeNull();
  });

  it('shows the display name with the @permanent name next to it', async () => {
    mockName = { id: 'u1', username: 'gordon', displayName: 'Gordon F.', isOfficial: false };
    await render(<UserName userId="u1" username="gordon" />);
    expect(screen.getByText(/Gordon F\./)).toBeTruthy();
    expect(screen.getByText(/@gordon/)).toBeTruthy();
  });

  it('shows the gold official badge for staff', async () => {
    mockName = { id: 'u1', username: 'gordon', displayName: null, isOfficial: true };
    await render(<UserName userId="u1" username="gordon" />);
    expect(screen.getByLabelText(OFFICIAL_LABEL)).toBeTruthy();
  });

  it('always shows the handle when asked (moderation)', async () => {
    mockName = { id: 'u1', username: 'gordon', displayName: null, isOfficial: false };
    await render(<UserName userId="u1" username="gordon" handle="always" />);
    expect(screen.getByText(/@gordon/)).toBeTruthy();
  });
});
