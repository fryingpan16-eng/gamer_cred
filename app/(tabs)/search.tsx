import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import type { SearchEntity } from '@/utils/queryKeys';

const ENTITY_TABS: readonly { key: SearchEntity; label: string; description: string }[] = [
  { key: 'games', label: 'Games', description: 'Search titles by name, genre, and platform (IGDB via Edge Function).' },
  { key: 'studios', label: 'Studios & Directors', description: 'Developers, publishers, and key creators (IGDB via Edge Function).' },
  { key: 'users', label: 'Users / Friends', description: 'Find community profiles by username and send friend requests.' },
];

export default function SearchScreen() {
  const [active, setActive] = useState<SearchEntity>('games');
  const current = ENTITY_TABS.find((t) => t.key === active) ?? ENTITY_TABS[0]!;

  return (
    <ScreenPlaceholder
      title="Search"
      subtitle="Games · Studios & Directors · Users"
      sections={[{ title: current.label, description: current.description }]}
    >
      <View className="flex-row flex-wrap gap-1 border-b border-steam-accent">
        {ENTITY_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.key === active }}
            onPress={() => setActive(tab.key)}
            className={tab.key === active ? 'steam-tab-active' : 'steam-tab'}
          >
            <Text className={tab.key === active ? 'text-steam-text-bright text-steam-sm' : 'text-steam-text-muted text-steam-sm'}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScreenPlaceholder>
  );
}
