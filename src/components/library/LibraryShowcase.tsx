import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { CoverShowcase } from '@/components/games/CoverShowcase';
import { RetroGamingPCButton } from '@/components/ui';
import { useLibrary } from '@/hooks/useLibrary';
import type { Profile } from '@/types/database.types';
import { groupLibrary } from '@/utils/library';

import { LibraryAddGamesButton } from './LibraryAddGamesButton';
import { LibraryPrivacyToggle } from './LibraryPrivacyToggle';

/**
 * Library on a profile: game count + the newest covers. Someone else's
 * private Library isn't shown at all (and isn't even requested).
 */
export function LibraryShowcase({ profile, isOwner }: { profile: Profile; isOwner: boolean }) {
  const isPublic = profile.library_visibility === 'public';
  const library = useLibrary(isOwner || isPublic ? profile.id : null);
  if (!isOwner && !isPublic) return null;
  const games = groupLibrary(library.data ?? []);
  const open = () => router.push({ pathname: '/library/[userId]', params: { userId: profile.id } });
  return (
    <CoverShowcase
      title={`Library${library.data ? ` (${games.length})` : ''}${isOwner && !isPublic ? ' · 🔒 only you' : ''}`}
      gameIds={games.map((g) => g.gameId)}
      isPending={library.isPending}
      error={library.error}
      headerRight={
        <View className="flex-row flex-wrap justify-end gap-2">
          {isOwner ? <LibraryPrivacyToggle compact /> : null}
          {isOwner ? <LibraryAddGamesButton /> : null}
          {games.length > 0 ? <RetroGamingPCButton variant="navigate" label="View all" onPress={open} /> : null}
        </View>
      }
      empty={
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          {isOwner ? 'Games you own. Tap + Add games, or use + Library on any game page or search result.' : 'Nothing in their library yet.'}
        </Text>
      }
    />
  );
}
