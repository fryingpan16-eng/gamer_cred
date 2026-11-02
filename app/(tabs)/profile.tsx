import { Text, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { SteamBadge, SteamCard, SteamPanel } from '@/components/ui';

const SECTIONS = [
  { title: 'Now Playing', description: 'Public view of your 4 active Now Playing slots.' },
  { title: 'Top 4 Favorites', description: 'Your all-time favorite games showcase.' },
] as const;

export default function ProfileScreen() {
  return (
    <ScreenPlaceholder subtitle="Your public gamer card" sections={SECTIONS}>
      <SteamPanel title="Hardware & Platforms">
        <View className="flex-row flex-wrap gap-2">
          <SteamCard className="min-w-[140px] gap-1">
            <Text className="text-steam-base font-bold text-steam-text-bright">PC</Text>
            <SteamBadge label="Main Platform" variant="main" />
            <Text className="text-steam-xs text-steam-text-muted">Specs: not set</Text>
          </SteamCard>
          <SteamCard className="min-w-[140px] items-center justify-center">
            <Text className="text-steam-sm text-steam-text-muted">+ Add platform</Text>
          </SteamCard>
        </View>
      </SteamPanel>
    </ScreenPlaceholder>
  );
}
