import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Text } from 'react-native';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { SteamInput, SteamPanel, SteamTabs, type SteamTabItem } from '@/components/ui';
import { steamColors } from '@/constants/theme';
import type { SearchEntity } from '@/utils/queryKeys';

const ENTITY_TABS: readonly SteamTabItem<SearchEntity>[] = [
  { key: 'games', label: 'Games' },
  { key: 'studios', label: 'Studios & Directors' },
  { key: 'users', label: 'Users / Friends' },
];

const DESCRIPTIONS: Record<SearchEntity, { placeholder: string; description: string }> = {
  games: {
    placeholder: 'Search games by title, genre, platform…',
    description: 'Title, genre, and platform search (IGDB via Edge Function cache).',
  },
  studios: {
    placeholder: 'Search studios, publishers, directors…',
    description: 'Developers, publishers, and key creators (IGDB via Edge Function cache).',
  },
  users: {
    placeholder: 'Search players by username…',
    description: 'Find community profiles and send friend requests.',
  },
};

export default function SearchScreen() {
  const [entity, setEntity] = useState<SearchEntity>('games');
  const [term, setTerm] = useState('');
  const current = DESCRIPTIONS[entity];

  return (
    <ScreenPlaceholder>
      <SteamTabs items={ENTITY_TABS} value={entity} onChange={setEntity} />
      <SteamInput
        value={term}
        onChangeText={setTerm}
        placeholder={current.placeholder}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={`Search ${entity}`}
        icon={<Feather name="search" size={12} color={steamColors.textMuted} />}
      />
      <SteamPanel title="Results">
        <Text className="text-steam-base text-steam-text">{current.description}</Text>
      </SteamPanel>
    </ScreenPlaceholder>
  );
}
