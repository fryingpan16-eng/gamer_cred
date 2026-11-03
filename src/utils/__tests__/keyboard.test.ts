import { keyboardOverlap } from '../keyboard';

describe('keyboardOverlap', () => {
  it('is the part of the view the keyboard covers', () => {
    expect(keyboardOverlap(800, 500)).toBe(300);
  });

  it('is 0 when the window already shrank above the keyboard', () => {
    expect(keyboardOverlap(500, 500)).toBe(0);
    expect(keyboardOverlap(480, 500)).toBe(0);
  });

  it('ignores bad measurements', () => {
    expect(keyboardOverlap(Number.NaN, 500)).toBe(0);
  });
});
