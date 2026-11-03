import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/utils/cn';
import { keyboardOverlap } from '@/utils/keyboard';

import { TitlebarCloseButton } from './RetroGamingPCModal';

export type RetroGamingPCSheetProps = {
  visible: boolean;
  title: string;
  /** ✕, Android back and the backdrop all call this. */
  onClose: () => void;
  /** Extra chrome beside the title (e.g. a Draft / Published badge). */
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Full-height overlay window pinned to the TOP of the screen, for writing long text.
 * The body scrolls, and it shrinks by exactly the part the on-screen keyboard covers,
 * so the field you are typing in stays visible above the keyboard.
 * Dialogs opened from inside (pickers, confirms) must be rendered as its children.
 */
export function RetroGamingPCSheet({ visible, title, onClose, headerRight, children, className }: RetroGamingPCSheetProps) {
  const insets = useSafeAreaInsets();
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  const [overlap, setOverlap] = useState(0);

  useEffect(() => {
    if (!visible || Platform.OS === 'web') return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      rootRef.current?.measureInWindow((_x, y, _w, h) => setOverlap(keyboardOverlap(y + h, keyboardTop)));
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setOverlap(0));
    return () => {
      show.remove();
      hide.remove();
      setOverlap(0);
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        ref={rootRef}
        className="flex-1 items-center px-2 md:px-4"
        style={{
          paddingTop: insets.top + 8,
          // Keyboard up: clear it exactly. Keyboard down: clear the home indicator.
          paddingBottom: overlap > 0 ? overlap + 8 : insets.bottom + 8,
        }}
      >
        <Pressable accessibilityLabel="Close" className="absolute inset-0 bg-black/70" onPress={onClose} />
        <View
          role="dialog"
          aria-modal
          aria-label={title}
          accessibilityViewIsModal
          className={cn('retrogamingpc-window max-h-full w-full max-w-[680px] flex-shrink', className)}
        >
          <View className="retrogamingpc-titlebar">
            <Text className="flex-1 text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
              {title}
            </Text>
            {headerRight ? <View className="mr-2">{headerRight}</View> : null}
            <TitlebarCloseButton onPress={onClose} />
          </View>
          <ScrollView
            className="flex-shrink bg-retrogamingpc-card"
            contentContainerClassName="p-3"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
