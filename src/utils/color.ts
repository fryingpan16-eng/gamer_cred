/** Small colour maths for contrast-safe tints (WCAG relative luminance). */

export function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` painted at `alpha` over `bg`, as an opaque #rrggbb. */
export function mix(fg: string, bg: string, alpha: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const out = [1, 3, 5].map((i) => Math.round(alpha * ch(fg, i) + (1 - alpha) * ch(bg, i)));
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The strongest tint of `color` over `base` (up to `maxAlpha`) that keeps body
 * text ≥ 7:1 and muted text ≥ 4.5:1 — the app's contrast minimums.
 */
export function readableTintAlpha(
  color: string,
  base: string,
  text: { body: string; muted: string },
  maxAlpha = 0.5,
  minAlpha = 0.1,
): number {
  for (let a = maxAlpha; a > minAlpha; a = Math.round((a - 0.01) * 100) / 100) {
    const bg = mix(color, base, a);
    if (contrast(text.body, bg) >= 7 && contrast(text.muted, bg) >= 4.5) return a;
  }
  return minAlpha;
}
