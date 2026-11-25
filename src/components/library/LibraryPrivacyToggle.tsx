import { Text, View } from 'react-native';

import { RetroGamingPCButton } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useUpdateLibraryVisibility } from '@/hooks/useLibrary';

import { LibraryChip } from './LibraryChip';

export const LIBRARY_PRIVATE_TEXT = 'Private, only you can see this';
export const LIBRARY_PUBLIC_TEXT = 'Public, anyone can see your Library';

/** Who can see your Library: the whole Library, its count and its preview follow this one setting. */
export function LibraryPrivacyToggle({ compact = false }: { compact?: boolean }) {
  const visibility = useAuthStore((s) => s.profile?.library_visibility ?? 'private');
  const update = useUpdateLibraryVisibility();
  const isPublic = visibility === 'public';

  if (compact) {
    return (
      <RetroGamingPCButton
        label={isPublic ? '🔓 Public' : '🔒 Private'}
        accessibilityLabel={`Library is ${isPublic ? LIBRARY_PUBLIC_TEXT : LIBRARY_PRIVATE_TEXT}. Tap to make it ${isPublic ? 'private' : 'public'}`}
        disabled={update.isPending}
        onPress={() => update.mutate(isPublic ? 'private' : 'public')}
      />
    );
  }

  return (
    <View className="gap-1">
      <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup" accessibilityLabel="Who can see your Library">
        <LibraryChip label={`🔒 ${LIBRARY_PRIVATE_TEXT}`} selected={!isPublic} disabled={update.isPending} onPress={() => isPublic && update.mutate('private')} />
        <LibraryChip label={`🔓 ${LIBRARY_PUBLIC_TEXT}`} selected={isPublic} disabled={update.isPending} onPress={() => !isPublic && update.mutate('public')} />
      </View>
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        {isPublic
          ? 'Signed-in players can see every game in your Library on your profile (except players you block).'
          : 'Nobody else sees your Library, its count or its games. Your ratings stay public as before.'}
      </Text>
    </View>
  );
}
