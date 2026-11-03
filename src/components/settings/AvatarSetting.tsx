import { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCConfirmModal, RetroGamingPCSaveStatus, RetroGamingPCSpinner } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useAvatarMutation } from '@/hooks/useProfile';
import { AvatarError, pickAvatarImage, type PreparedAvatar } from '@/services/avatar';

/**
 * Profile picture from the photo library (phones) or file browser (web).
 * Picked images are cropped square and resized to 512×512 before upload;
 * a preview is shown until the upload finishes.
 */
export function AvatarSetting() {
  const profile = useAuthStore((s) => s.profile);
  const mutation = useAvatarMutation();
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const busy = preparing || mutation.isPending;
  const shown = preview ?? profile?.avatar_url ?? null;
  const initial = (profile?.username ?? '?').slice(0, 1).toUpperCase();

  const choose = async () => {
    setPickError(null);
    mutation.reset();
    setPreparing(true);
    let picked: PreparedAvatar | null = null;
    try {
      picked = await pickAvatarImage();
    } catch (error) {
      setPickError(error instanceof AvatarError ? error.message : 'Couldn’t open your photos.');
    } finally {
      setPreparing(false);
    }
    if (!picked) return;
    setPreview(picked.previewUri);
    mutation.mutate(picked, { onSettled: () => setPreview(null) });
  };

  return (
    <View className="flex-row flex-wrap items-center gap-3">
      <View className="retrogamingpc-bevel-inset h-20 w-20 items-center justify-center overflow-hidden bg-retrogamingpc-dark">
        {shown ? (
          <Image source={{ uri: shown }} className="h-full w-full" resizeMode="cover" accessibilityLabel="Your profile picture" />
        ) : (
          <Text className="font-mono text-[32px] font-bold text-retrogamingpc-text-muted">{initial}</Text>
        )}
        {busy ? (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <RetroGamingPCSpinner />
          </View>
        ) : null}
      </View>

      <View className="min-w-[180px] flex-1 gap-2">
        <View className="flex-row flex-wrap gap-2">
          <RetroGamingPCButton variant="create"
            label={Platform.OS === 'web' ? 'Choose File…' : 'Choose from Gallery'}
            loading={busy}
            onPress={() => void choose()}
          />
          {profile?.avatar_url ? (
            <RetroGamingPCButton label="Remove" variant="danger" disabled={busy} onPress={() => setConfirmRemove(true)} />
          ) : null}
        </View>
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          {mutation.isPending ? 'Uploading…' : 'JPG, PNG or WebP. Cropped to a square and resized automatically.'}
        </Text>
        <RetroGamingPCSaveStatus pending={false} savedAt={mutation.isSuccess ? mutation.submittedAt : null} />
        {pickError ? <RetroGamingPCAlert message={pickError} /> : null}
        {mutation.isError ? <RetroGamingPCAlert message={mutation.error.message} /> : null}
      </View>

      <RetroGamingPCConfirmModal
        visible={confirmRemove}
        title="Remove profile picture"
        message="Remove your profile picture? Your initial will be shown instead."
        confirmLabel="Remove"
        destructive
        busy={mutation.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => mutation.mutate(null, { onSettled: () => setConfirmRemove(false) })}
      />
    </View>
  );
}
