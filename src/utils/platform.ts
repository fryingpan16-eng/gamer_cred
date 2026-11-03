import { Platform } from 'react-native';

/**
 * Phone browsers (iOS Safari especially) zoom the whole page when you focus a
 * text field whose font is smaller than 16px. The retro type scale is 10–14px,
 * so on touch screens in a browser every TextInput gets 16px. Native apps and
 * desktop browsers keep the compact size.
 */
const IS_TOUCH_WEB =
  Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

export const noZoomInputStyle: { fontSize?: number } = IS_TOUCH_WEB ? { fontSize: 16 } : {};

/** Comfortable extra touch area for compact controls (no visual change). */
export const TOUCH_SLOP = { top: 8, bottom: 8, left: 4, right: 4 } as const;
