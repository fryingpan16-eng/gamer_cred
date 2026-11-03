import { fireEvent, render, screen } from '@testing-library/react-native';

import { RetroGamingPCBarChart } from '@/components/ui/RetroGamingPCBarChart';
import type { BarDatum } from '@/utils/stats';

// Bars are hidden from screen readers on purpose (they get the summary + table),
// so visual-bar queries opt in to hidden elements.
const visual = { includeHiddenElements: true } as const;

const STUDIOS: BarDatum[] = Array.from({ length: 13 }, (_, i) => ({ key: `d${i}`, label: `Studio ${i + 1}`, value: 13 - i }));

describe('RetroGamingPCBarChart', () => {
  it('shows the top N, then every bar after "Show all"', async () => {
    await render(<RetroGamingPCBarChart title="Games per studio" data={STUDIOS} orientation="horizontal" topN={10} showAllToggle />);
    expect(screen.getByText('Studio 10', visual)).toBeTruthy();
    expect(screen.queryByText('Studio 11', visual)).toBeNull();
    await fireEvent.press(screen.getByText('Show all 13'));
    expect(screen.getByText('Studio 13', visual)).toBeTruthy();
    expect(screen.getByText('Show top 10')).toBeTruthy();
  });

  it('gives the exact value on tap and a full text table', async () => {
    await render(<RetroGamingPCBarChart title="Games per platform" data={STUDIOS.slice(0, 3)} orientation="vertical" />);
    await fireEvent.press(screen.getByText('Studio 2', visual));
    // the visual bars are not exposed to assistive tech
    expect(screen.queryByText('Studio 2')).toBeNull();
    expect(screen.getByText('Studio 2: 12 games')).toBeTruthy(); // tooltip line
    await fireEvent.press(screen.getByRole('button', { name: 'Show Games per platform as a table' }));
    expect(screen.getByLabelText('Studio 1: 13 games')).toBeTruthy(); // screen-reader table rows
    expect(screen.getByLabelText('Studio 3: 11 games')).toBeTruthy();
  });

  it('summarises the chart for screen readers', async () => {
    await render(<RetroGamingPCBarChart title="Games per decade" data={STUDIOS.slice(0, 2)} />);
    expect(screen.getByLabelText(/Games per decade: Studio 1 13, Studio 2 12/)).toBeTruthy();
  });
});
