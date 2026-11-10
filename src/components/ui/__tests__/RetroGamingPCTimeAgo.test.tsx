import { fireEvent, render, screen } from '@testing-library/react-native';

import { fullDate, RetroGamingPCTimeAgo } from '../RetroGamingPCTimeAgo';

describe('RetroGamingPCTimeAgo', () => {
  it('shows how long ago, and the full date on long-press', async () => {
    const iso = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    await render(<RetroGamingPCTimeAgo iso={iso} suffix=" · edited" />);
    expect(screen.getByText('3 days ago · edited')).toBeTruthy();
    await fireEvent(screen.getByText('3 days ago · edited'), 'longPress');
    expect(screen.getByText(`${fullDate(iso)} · edited`)).toBeTruthy();
  });
});
