import { Stack, useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <>
      {/* Dynamic header title; becomes the game's name once IGDB data is wired up. */}
      <Stack.Screen options={{ title: `Game #${id}` }} />
      <ScreenPlaceholder
        subtitle={`IGDB #${id}`}
        sections={[
          { title: 'Overview', description: 'Cover art, studio, director, release info (IGDB cache).' },
          { title: 'Community Reviews', description: 'Published reviews and aggregate score.' },
        ]}
      />
    </>
  );
}
