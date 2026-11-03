import type { ReactNode } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { RetroGamingPCBadge, RetroGamingPCPanel } from '@/components/ui';
import { useAuthStore } from '@/hooks/useAuth';
import { useFriendCount } from '@/hooks/useProfile';
import type { Profile } from '@/types/database.types';
import { TOUCH_SLOP } from '@/utils/platform';

import { ProfilePlatforms } from './ProfilePlatforms';

type ProfileHeaderProps = {
  profile: Profile;
  /** Right-side actions (friend button, settings, etc.). */
  actions?: ReactNode;
};

/** Gamer card header: avatar, username, friend count, and the player's platforms. */
export function ProfileHeader({ profile, actions }: ProfileHeaderProps) {
  const friends = useFriendCount(profile.id);
  const isOwner = useAuthStore((s) => s.user?.id === profile.id);

  return (
    <RetroGamingPCPanel>
      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-3">
          <Thumbnail uri={profile.avatar_url} fallback={profile.username} shape="square" accessibilityLabel={`${profile.username} avatar`} />
          <View className="min-w-[160px] flex-1 gap-1">
            <Text className="text-retrogamingpc-xl font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
              {profile.username}
            </Text>
            <View className="flex-row flex-wrap gap-1">
              {/* Opens the friends list (yours also shows pending requests). */}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${friends.data ?? 'Unknown number of'} friends. Open friends list`}
                hitSlop={TOUCH_SLOP}
                onPress={() => router.push({ pathname: '/friends/[userId]', params: { userId: profile.id } })}
              >
                <RetroGamingPCBadge label={`${friends.data ?? '–'} friend${friends.data === 1 ? '' : 's'} ▸`} />
              </Pressable>
            </View>
          </View>
          {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
        </View>
        <ProfilePlatforms userId={profile.id} isOwner={isOwner} />
      </View>
    </RetroGamingPCPanel>
  );
}
