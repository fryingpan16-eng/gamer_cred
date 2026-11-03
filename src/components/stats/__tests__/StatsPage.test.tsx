import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { StatsPage } from '../StatsPage';
import { STATS, type StatDefinition } from '../statsConfig';

const mounted: string[] = [];
const makeStat = (id: string, title: string): StatDefinition => ({
  id,
  title,
  description: `${title} description`,
  component: () => {
    mounted.push(id);
    return <Text>{`${title} content`}</Text>;
  },
});
const TEST_STATS = [makeStat('alpha', 'Alpha'), makeStat('beta', 'Beta'), makeStat('gamma', 'Gamma')];

describe('Stats menu', () => {
  beforeEach(() => {
    mounted.length = 0;
  });

  it('lists every configured stat and renders only the selected one', async () => {
    await render(<StatsPage selectedId="beta" onSelect={() => {}} stats={TEST_STATS} />);
    for (const s of TEST_STATS) expect(screen.getAllByText(s.title).length).toBeGreaterThan(0);
    expect(screen.getByText('Beta content')).toBeTruthy();
    expect(screen.queryByText('Alpha content')).toBeNull();
    expect(screen.queryByText('Gamma content')).toBeNull();
    expect(new Set(mounted)).toEqual(new Set(['beta'])); // lazy: nothing else mounted
  });

  it('falls back to the first stat and reports menu selections', async () => {
    const onSelect = jest.fn();
    await render(<StatsPage selectedId={undefined} onSelect={onSelect} stats={TEST_STATS} />);
    expect(screen.getByText('Alpha content')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Gamma' }));
    expect(onSelect).toHaveBeenCalledWith('gamma');
  });

  it('the real config has unique ids and a component for every entry', () => {
    expect(new Set(STATS.map((s) => s.id)).size).toBe(STATS.length);
    for (const s of STATS) expect(typeof s.component).toBe('function');
  });
});
