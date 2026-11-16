import { forwardRef, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { keyboardOverlap } from '@/utils/keyboard';

/** Space kept between the focused field and the top of the keyboard. */
const FIELD_MARGIN = 20;

/**
 * ScrollView that keeps the focused text field above the on-screen keyboard on every platform.
 * - iOS: `automaticallyAdjustKeyboardInsets` (the native inset + scroll).
 * - Android: edge-to-edge (Expo Go, SDK 54+) never shrinks the window for the keyboard, so this
 *   adds bottom space equal to the covered part and scrolls the focused field into view. The
 *   keyboard's reported top edge leaves out the navigation bar there, so that is subtracted too
 *   (on a device that already counts it, this only adds a little extra space).
 * - Web: the browser handles it.
 * Use this for every scrolling screen with inputs (keyboardShouldPersistTaps="handled" is on).
 */
export const KeyboardAwareScrollView = forwardRef<ScrollViewInstance, ScrollViewProps>(function KeyboardAwareScrollView(
  { children, onScroll, scrollEventThrottle, keyboardShouldPersistTaps = 'handled', ...rest },
  ref,
) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollViewInstance);
  const scrollY = useRef(0);
  /** Visible height of the scroll view above the keyboard, waiting for the inset to render. */
  const pendingReveal = useRef<number | null>(null);
  const [inset, setInset] = useState(0);
  const navBar = useRef(0);
  // Context, not useSafeAreaInsets(): works (as 0) where no provider is mounted, e.g. tests.
  navBar.current = useContext(SafeAreaInsetsContext)?.bottom ?? 0;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      scrollRef.current?.getNativeScrollRef()?.measureInWindow((_x: number, y: number, _w: number, height: number) => {
        const overlap = keyboardOverlap(y + height, e.endCoordinates.screenY - navBar.current);
        pendingReveal.current = overlap > 0 ? height - overlap : null;
        setInset(overlap);
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      pendingReveal.current = null;
      setInset(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Once the extra bottom space is laid out, scroll the focused field just above the keyboard.
  useEffect(() => {
    const visibleHeight = pendingReveal.current;
    if (visibleHeight === null || inset === 0) return;
    pendingReveal.current = null;
    const frame = requestAnimationFrame(() => {
      const input = TextInput.State.currentlyFocusedInput();
      const content = scrollRef.current?.getInnerViewRef();
      if (!input || !content) return;
      input.measureLayout(
        content,
        (_x, y, _w, height) => {
          const fieldBottom = y + height + FIELD_MARGIN;
          if (fieldBottom > scrollY.current + visibleHeight) {
            scrollRef.current?.scrollTo({ y: fieldBottom - visibleHeight, animated: true });
          }
        },
        () => undefined,
      );
    });
    return () => cancelAnimationFrame(frame);
  }, [inset]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.current = e.nativeEvent.contentOffset.y;
    onScroll?.(e);
  };

  return (
    <ScrollView
      ref={scrollRef}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEventThrottle={scrollEventThrottle ?? 32}
      onScroll={handleScroll}
      {...rest}
    >
      {children}
      {inset > 0 ? <View style={{ height: inset }} /> : null}
    </ScrollView>
  );
});
