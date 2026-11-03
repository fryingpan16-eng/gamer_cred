/**
 * How far the on-screen keyboard covers a view, in px.
 * `viewBottom` is the view's bottom edge and `keyboardTop` the keyboard's top edge, both
 * measured from the top of the screen. When the OS already shrank the window for the
 * keyboard (Android adjustResize), the view ends above the keyboard and this is 0.
 */
export function keyboardOverlap(viewBottom: number, keyboardTop: number): number {
  if (!Number.isFinite(viewBottom) || !Number.isFinite(keyboardTop)) return 0;
  return Math.max(0, Math.round(viewBottom - keyboardTop));
}
