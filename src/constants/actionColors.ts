/**
 * Action colours: FIXED across every theme (not CSS variables), so the same
 * kind of action always looks the same. Values: actionColors.json (also used
 * by tailwind.config.js). Contrast is checked in src/utils/__tests__/actionColors.test.ts.
 *
 *   save      bright green — save, publish, update, confirm, accept, log in
 *   cancel    red          — cancel, close, exit, decline, sign out
 *   danger    deep red + ⚠ — delete, remove, discard (can't be undone)
 *   create    bright green — start / add something new (write a review, add friend, assign a slot);
 *                            same colours as save
 *   navigate  blue         — go somewhere (view details, view profile, open in Review Studio)
 *
 * Everything else uses the themed `default` / `primary` buttons. The matching
 * text colours on theme surfaces (status text, outlines, icons) are theme tokens
 * (`saveText`, `cancelText`, `navigateText` from useThemeColors()), darker in the light theme.
 */
import colors from './actionColors.json';

export type ActionKind = keyof typeof colors;

export type ActionColor = {
  /** Button face. */
  fill: string;
  hover: string;
  pressed: string;
  /** Bevel highlight (top/left) and shadow (bottom/right). */
  light: string;
  dark: string;
  /** Label colour on the fill. */
  label: string;
};

export const ACTION_COLORS: Record<ActionKind, ActionColor> = colors;
export const ACTION_KINDS = Object.keys(colors) as ActionKind[];

export function isActionKind(value: string): value is ActionKind {
  return value in colors;
}
