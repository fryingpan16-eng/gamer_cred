import { Stack, useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { useGameLookup } from '@/hooks/useGames';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameId = Number(id);
  const lookup = useGameLookup(Number.isSafeInteger(gameId) ? [gameId] : []);
  const game = lookup.data?.get(gameId);

  return (
    <>
      {/* Dynamic header title from the cached IGDB record. */}
      <Stack.Screen options={{ title: game?.name ?? `Game #${id}` }} />
      <ScreenPlaceholder
        subtitle={game ? [game.releaseYear, game.developers[0]].filter(Boolean).join(' · ') : `IGDB #${id}`}
        sections={[
          { title: 'Overview', description: 'Cover art, studio, director, release info (IGDB cache).' },
          { title: 'Community Reviews', description: 'Published reviews and aggregate score.' },
        ]}
      />
    </>
  );
}
