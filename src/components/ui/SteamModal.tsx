import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

import { SteamButton } from './SteamButton';

export type SteamModalProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Action row (usually SteamButtons), right-aligned beneath the body. */
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
        pressed ? 'steam-bevel-inset bg-steam-dark' : 'steam-bevel bg-steam-button',
      )}
    >
      <Text className="text-steam-xs font-bold text-steam-text-bright">✕</Text>
    </Pressable>
  );
}

/** Classic 2004 Steam popup: title bar chrome, tactile ✕, beveled body, optional action row. */
export function SteamModal({
  visible,
  title,
  onClose,
  children,
  footer,
  dismissOnBackdrop = true,
  className,
}: SteamModalProps) {
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
          className={cn('steam-window w-full max-w-[440px]', className)}
        >
          <View className="steam-titlebar">
            <Text className="flex-1 text-steam-sm font-bold text-steam-text-bright" numberOfLines={1}>
              {title}
            </Text>
            <TitlebarCloseButton onPress={onClose} />
          </View>
          <View className="bg-steam-card p-3">{children}</View>
          {footer ? (
            <View className="flex-row justify-end gap-2 border-t border-t-steam-accent bg-steam-card px-3 py-2">
              {footer}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export type SteamConfirmModalProps = {
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

/** Yes/No confirmation built on SteamModal (e.g. removing a Now Playing slot). */
export function SteamConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: SteamConfirmModalProps) {
  return (
    <SteamModal
      visible={visible}
      title={title}
      onClose={onCancel}
      dismissOnBackdrop={!busy}
      footer={
        <>
          <SteamButton label={cancelLabel} onPress={onCancel} disabled={busy} />
          <SteamButton
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            disabled={busy}
          />
        </>
      }
    >
      <Text className="text-steam-base text-steam-text">{message}</Text>
    </SteamModal>
  );
}
