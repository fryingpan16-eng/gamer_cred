/**
 * One size for the big "headline" score on the game page, shared by the
 * Gamer Cred score box (display) and the Your rating box (the input), so the
 * two sit side by side at exactly the same size. Cells keep 36px touch targets.
 */
export const HERO_SCORE = {
  /** Star glyph size and the width of each star's cell. */
  starGlyph: 28,
  starCell: 36,
  /** Height of the headline row (stars, chips, number field). */
  rowHeight: 40,
  /** Headline value text, e.g. "4.5★" or "84.3". */
  valueClass: 'font-mono font-bold text-[28px] leading-[32px]',
} as const;
