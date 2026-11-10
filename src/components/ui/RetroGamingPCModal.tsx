import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';

import { ACTION_COLORS } from '@/constants/actionColors';
import { cn } from '@/utils/cn';

import { RetroGamingPCButton } from './RetroGamingPCButton';

export type RetroGamingPCModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Action row (usually RetroGamingPCButtons), right-aligned beneath the body. */
  footer?: ReactNode;
  /** Close when the dimmed backdrop is tapped. Default true. */
  dismissOnBackdrop?: boolean;
  /**
   * Scroll the body when it is taller than the screen (default). Pass false for
   * bodies that manage their own scrolling list (e.g. the game picker).
   */
  scrollable?: boolean;
  className?: string;
};

const CANCEL = ACTION_COLORS.cancel;

export function TitlebarCloseButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close dialog"
      // Phones: 28px chrome, ~52px touch area (thumbs). Desktop: 22px, ~46px.
      hitSlop={12}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      // Exit = the fixed "cancel" red in every theme.
      style={{
        backgroundColor: pressed ? CANCEL.pressed : CANCEL.fill,
        borderTopColor: pressed ? CANCEL.dark : CANCEL.light,
        borderLeftColor: pressed ? CANCEL.dark : CANCEL.light,
        borderBottomColor: pressed ? CANCEL.light : CANCEL.dark,
        borderRightColor: pressed ? CANCEL.light : CANCEL.dark,
      }}
      className="h-[28px] w-[28px] items-center justify-center border md:h-[22px] md:w-[22px]"
    >
      <Text className="text-retrogamingpc-base font-bold md:text-retrogamingpc-sm" style={{ color: CANCEL.label }}>
        ✕
      </Text>
    </Pressable>
  );
}

/** Classic retro popup: title bar chrome, tactile ✕, beveled body, optional action row. */
export function RetroGamingPCModal({
  visible,
  title,
  onClose,
  children,
  footer,
  dismissOnBackdrop = true,
  scrollable = true,
  className,
}: RetroGamingPCModalProps) {
  const { height } = useWindowDimensions();
  // Leave room for the title bar, footer and screen margins on short phones.
  const bodyMaxHeight = Math.max(200, height * 0.72);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Lifts the dialog above the on-screen keyboard (Android resizes the window itself). */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 items-center justify-center p-4">
        <Pressable
          accessibilityLabel="Dismiss dialog"
          className="absolute inset-0 bg-black/60"
          onPress={dismissOnBackdrop ? onClose : undefined}
        />
        <View
          role="dialog"
          aria-modal
          aria-label={title}
          accessibilityViewIsModal
          className={cn('retrogamingpc-window w-full max-w-[440px]', className)}
        >
          <View className="retrogamingpc-titlebar">
            <Text className="flex-1 text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
              {title}
            </Text>
            <TitlebarCloseButton onPress={onClose} />
          </View>
          {scrollable ? (
            <ScrollView style={{ maxHeight: bodyMaxHeight }} className="bg-retrogamingpc-card" contentContainerClassName="p-3" keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View className="bg-retrogamingpc-card p-3">{children}</View>
          )}
          {footer ? (
            <View className="flex-row justify-end gap-2 border-t border-t-retrogamingpc-accent bg-retrogamingpc-card px-3 py-2">
              {footer}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type RetroGamingPCConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Disables the buttons while the confirmed action runs. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Yes/No confirmation built on RetroGamingPCModal (e.g. removing a Now Playing slot). */
export function RetroGamingPCConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: RetroGamingPCConfirmModalProps) {
  return (
    <RetroGamingPCModal
      visible={visible}
      title={title}
      onClose={onCancel}
      dismissOnBackdrop={!busy}
      footer={
        <>
          <RetroGamingPCButton label={cancelLabel} variant="cancel" onPress={onCancel} disabled={busy} />
          <RetroGamingPCButton
            label={confirmLabel}
            variant={destructive ? 'danger' : 'save'}
            onPress={onConfirm}
            disabled={busy}
          />
        </>
      }
    >
      <Text className="text-retrogamingpc-base text-retrogamingpc-text">{message}</Text>
    </RetroGamingPCModal>
  );
}
