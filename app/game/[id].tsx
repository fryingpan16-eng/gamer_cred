import { useLocalSearchParams } from 'expo-router';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

export default function GameDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <ScreenPlaceholder
      title={`Game #${id}`}
      subtitle="Game detail"
      sections={[
        { title: 'Overview', description: 'Cover art, studio, director, release info (IGDB cache).' },
        { title: 'Community Reviews', description: 'Published reviews and aggregate score.' },
      ]}
    />
  );
}
