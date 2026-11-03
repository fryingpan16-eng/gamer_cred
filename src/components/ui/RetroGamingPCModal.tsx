import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

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
  className?: string;
};

function TitlebarCloseButton({ onPress }: { onPress: () => void }) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close dialog"
      hitSlop={8}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      className={cn(
        'h-[18px] w-[18px] items-center justify-center',
        pressed ? 'retrogamingpc-bevel-inset bg-retrogamingpc-dark' : 'retrogamingpc-bevel bg-retrogamingpc-button',
      )}
    >
      <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">✕</Text>
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
  className,
}: RetroGamingPCModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 items-center justify-center p-4">
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
          <View className="bg-retrogamingpc-card p-3">{children}</View>
          {footer ? (
            <View className="flex-row justify-end gap-2 border-t border-t-retrogamingpc-accent bg-retrogamingpc-card px-3 py-2">
              {footer}
            </View>
          ) : null}
        </View>
      </View>
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
          <RetroGamingPCButton label={cancelLabel} onPress={onCancel} disabled={busy} />
          <RetroGamingPCButton
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
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
