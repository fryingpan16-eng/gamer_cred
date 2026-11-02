import { Text, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';

const SECTIONS = [
  { title: 'Running Notes', description: 'Per-slot notes captured while you play.' },
  { title: 'Preliminary Score', description: 'Work-in-progress rating for each active game.' },
  { title: 'Publish Review', description: 'Convert a Now Playing draft into a published community review.' },
  { title: 'Quick Review', description: 'Rate and review any game without occupying a Now Playing slot.' },
] as const;

const SLOTS = [1, 2, 3, 4] as const;

export default function PostScreen() {
  return (
    <ScreenPlaceholder title="Review Studio" subtitle="Now Playing · drafts · publishing" sections={SECTIONS}>
      <View className="steam-panel gap-2">
        <Text className="steam-heading">Now Playing</Text>
        <View className="flex-row flex-wrap gap-2">
          {SLOTS.map((slot) => (
            <View
              key={slot}
              className="steam-bevel-inset bg-steam-dark w-[47%] md:w-[23%] aspect-[3/4] items-center justify-center"
            >
              <Text className="text-steam-text-muted text-steam-sm font-mono">SLOT {slot}</Text>
              <Text className="text-steam-highlight text-steam-xl">+</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenPlaceholder>
  );
}
