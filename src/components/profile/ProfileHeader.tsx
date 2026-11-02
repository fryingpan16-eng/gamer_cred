import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import { SteamBadge, SteamPanel } from '@/components/ui';
import { platformInfo } from '@/constants/platforms';
import { useFriendCount, usePlatforms } from '@/hooks/useProfile';
import type { Profile } from '@/types/database.types';

type ProfileHeaderProps = {
  profile: Profile;
  /** Right-side actions (friend button, etc.). */
  actions?: ReactNode;
};

/** Gamer card header: avatar, username, main platform badge, friend count. */
export function ProfileHeader({ profile, actions }: ProfileHeaderProps) {
  const friends = useFriendCount(profile.id);
  const platforms = usePlatforms(profile.id);
  const main = platforms.data?.find((p) => p.is_main);

  return (
    <SteamPanel>
      <View className="flex-row flex-wrap items-center gap-3">
        <Thumbnail uri={profile.avatar_url} fallback={profile.username} shape="square" accessibilityLabel={`${profile.username} avatar`} />
        <View className="min-w-[160px] flex-1 gap-1">
          <Text className="text-steam-xl font-bold text-steam-text-bright" numberOfLines={1}>
            {profile.username}
          </Text>
          <View className="flex-row flex-wrap gap-1">
            {main ? <SteamBadge label={`Main: ${platformInfo(main.platform_id).short}`} variant="main" /> : null}
            <SteamBadge label={`${friends.data ?? '–'} friend${friends.data === 1 ? '' : 's'}`} />
          </View>
        </View>
        {actions ? <View className="flex-row flex-wrap gap-2">{actions}</View> : null}
      </View>
    </SteamPanel>
  );
}
