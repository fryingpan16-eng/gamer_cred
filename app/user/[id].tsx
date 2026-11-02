import { Stack, useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      {/* Dynamic header title; becomes the player's username once profiles are wired up. */}
      <Stack.Screen options={{ title: 'Player Profile' }} />
      <ScreenPlaceholder
        subtitle={`User ${id}`}
        sections={[
          { title: 'Now Playing', description: "This player's active slots." },
          { title: 'Top 4 Favorites', description: 'All-time favorites showcase.' },
          { title: 'Platforms', description: 'Hardware roster and Main platform badge.' },
          { title: 'Friendship', description: 'Friend status and request actions.' },
        ]}
      />
    </>
  );
}
