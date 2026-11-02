import { useState } from 'react';
import { Text, View } from 'react-native';

import { ScreenPlaceholder } from '@/components/ScreenPlaceholder';
import { SteamBadge, SteamButton, SteamCard, SteamConfirmModal, SteamPanel } from '@/components/ui';
import type { NowPlayingSlot } from '@/types/database.types';

const SECTIONS = [
  { title: 'Running Notes', description: 'Per-slot notes captured while you play.' },
  { title: 'Preliminary Score', description: 'Work-in-progress rating for each active game.' },
  { title: 'Publish Review', description: 'Convert a Now Playing draft into a published community review.' },
  { title: 'Quick Review', description: 'Rate and review any game without occupying a Now Playing slot.' },
] as const;

const SLOTS: readonly NowPlayingSlot[] = [1, 2, 3, 4];

export default function PostScreen() {
  const [pendingRemoval, setPendingRemoval] = useState<NowPlayingSlot | null>(null);

  return (
    <ScreenPlaceholder subtitle="Now Playing · drafts · publishing" sections={SECTIONS}>
      <SteamPanel title="Now Playing" headerRight={<SteamBadge label="4 slots" variant="nowPlaying" />}>
        <View className="flex-row flex-wrap gap-2">
          {SLOTS.map((slot) => (
            <View key={slot} className="w-[47%] md:w-[23%]">
              <SteamCard className="aspect-[3/4] items-center justify-center gap-2">
                <Text className="font-mono text-steam-sm text-steam-text-muted">SLOT {slot}</Text>
                <Text className="text-steam-xl text-steam-highlight">+</Text>
                <SteamBadge label="Empty" variant="draft" />
              </SteamCard>
              <SteamButton label="Remove" variant="danger" className="mt-1" onPress={() => setPendingRemoval(slot)} />
            </View>
          ))}
        </View>
      </SteamPanel>

      <SteamConfirmModal
        visible={pendingRemoval !== null}
        title="Remove from Now Playing"
        message={`Remove the game in slot ${pendingRemoval ?? ''}? Its running notes and preliminary score will be discarded.`}
        confirmLabel="Remove"
        destructive
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => setPendingRemoval(null)}
      />
    </ScreenPlaceholder>
  );
}
