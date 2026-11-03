import { fireEvent, render, screen } from '@testing-library/react-native';

import { useAuthStore } from '@/hooks/useAuth';
import { storedFromStars } from '@/utils/quickRating';
import { toStoredRating } from '@/utils/rating';

import { QuickRating } from '../QuickRating';

// Individual stars / chips sit inside one adjustable control, so query them as hidden elements.
const inner = { includeHiddenElements: true } as const;

function setPrimaryScale(scale: 'numeric' | 'tier' | 'stars' | 'rounded') {
  useAuthStore.setState({ profile: { primary_rating_scale: scale } as never });
}

afterEach(() => useAuthStore.setState({ profile: null }));

describe('QuickRating', () => {
  it('uses the viewer’s chosen scale from Settings', async () => {
    setPrimaryScale('tier');
    await render(<QuickRating gameId={1} gameName="Hades" value={null} onChange={jest.fn()} />);
    expect(screen.getByLabelText(/^Your rating for Hades \(Tier/)).toBeTruthy();
    expect(screen.getByTestId('quick-rating-1-S**', inner)).toBeTruthy();
    expect(screen.queryByTestId('quick-rating-1-3.5', inner)).toBeNull();
  });

  it('stars: one tap sets a half-star rating; the same star or ✕ clears', async () => {
    setPrimaryScale('stars');
    const onChange = jest.fn();
    const { rerender } = await render(<QuickRating gameId={1} gameName="Hades" value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('quick-rating-1-3.5', inner));
    expect(onChange).toHaveBeenLastCalledWith(storedFromStars(3.5));
    await rerender(<QuickRating gameId={1} gameName="Hades" value={storedFromStars(3.5)} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('quick-rating-1-3.5', inner));
    expect(onChange).toHaveBeenLastCalledWith(null);
    await fireEvent.press(screen.getByLabelText('Clear your rating for Hades'));
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('tier and rounded: one tap on a chip sets it in that scale', async () => {
    const onChange = jest.fn();
    setPrimaryScale('tier');
    const { unmount } = await render(<QuickRating gameId={2} value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('quick-rating-2-A+', inner));
    expect(onChange).toHaveBeenLastCalledWith(toStoredRating({ scale: 'tier', value: 'A+' }));
    await unmount();
    setPrimaryScale('rounded');
    await render(<QuickRating gameId={2} value={null} onChange={onChange} />);
    await fireEvent.press(screen.getByTestId('quick-rating-2-8', inner));
    expect(onChange).toHaveBeenLastCalledWith(toStoredRating({ scale: 'rounded', value: 8 }));
  });

  it('1–100: type and press Enter, or step with − / +', async () => {
    setPrimaryScale('numeric');
    const onChange = jest.fn();
    await render(<QuickRating gameId={3} value={toStoredRating({ scale: 'numeric', value: 80 })} onChange={onChange} />);
    const field = screen.getByTestId('quick-rating-3');
    await fireEvent.changeText(field, '87');
    await fireEvent(field, 'submitEditing');
    expect(onChange).toHaveBeenLastCalledWith(toStoredRating({ scale: 'numeric', value: 87 }));
    await fireEvent.press(screen.getByLabelText('Increase by 1'));
    expect(onChange).toHaveBeenLastCalledWith(toStoredRating({ scale: 'numeric', value: 81 }));
    // out-of-range input is ignored
    onChange.mockClear();
    await fireEvent.changeText(field, '250');
    await fireEvent(field, 'submitEditing');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows an existing score in the viewer’s scale', async () => {
    setPrimaryScale('rounded');
    await render(<QuickRating gameId={4} value={{ numeric: 92, inputScale: 'numeric', input: '92' }} onChange={jest.fn()} />);
    expect(screen.getByTestId('quick-rating-4').props.accessibilityValue).toEqual({ text: '9 out of 10' });
  });

  it('screen-reader increment / decrement step one value', async () => {
    setPrimaryScale('stars');
    const onChange = jest.fn();
    await render(<QuickRating gameId={1} value={storedFromStars(4)} onChange={onChange} />);
    await fireEvent(screen.getByTestId('quick-rating-1'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith(storedFromStars(4.5));
  });

  it('readOnly shows the rating with no way to change it', async () => {
    setPrimaryScale('stars');
    await render(<QuickRating gameId={1} value={storedFromStars(2)} readOnly onChange={jest.fn()} />);
    expect(screen.queryByTestId('quick-rating-1-2', inner)).toBeNull();
    expect(screen.queryByTestId('quick-rating-1-clear')).toBeNull();
    expect(screen.getByTestId('quick-rating-1').props.accessibilityRole).toBe('image');
  });
});
