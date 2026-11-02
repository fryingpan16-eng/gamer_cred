import { useWindowDimensions } from 'react-native';

/** Matches Tailwind's `md` breakpoint (768px). */
export const DESKTOP_BREAKPOINT = 768;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
