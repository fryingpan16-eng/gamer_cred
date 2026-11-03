import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCModal, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useNowPlaying, useUpdateNowPlayingSlot } from '@/hooks/useNowPlaying';
import { showToast } from '@/hooks/useToastStore';
import { NOW_PLAYING_SLOTS } from '@/services/nowPlaying';
import type { NowPlayingSlot } from '@/types/database.types';
import type { IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';

type SlotChooserProps = { visible: boolean; game: IgdbGameResult; onClose: () => void; onAssigned: (slot: NowPlayingSlot) => void };

/** Pick one of the 4 slots. Occupied slots ask for a second tap to confirm the replacement. */
function SlotChooserModal({ visible, game, onClose, onAssigned }: SlotChooserProps) {
  const nowPlaying = useNowPlaying();
  const rows = nowPlaying.data ?? [];
  const titles = useGameLookup(rows.map((r) => r.game_id));
  const assign = useUpdateNowPlayingSlot();
  const [armed, setArmed] = useState<NowPlayingSlot | null>(null);

  const choose = (slot: NowPlayingSlot) => {
    const occupied = rows.some((r) => r.slot_index === slot);
    if (occupied && armed !== slot) {
      setArmed(slot);
      return;
    }
    assign.mutate(
      { slot, gameId: game.id },
      {
        onSuccess: () => {
          setArmed(null);
          onAssigned(slot);
        },
      },
    );
  };

  return (
    <RetroGamingPCModal visible={visible} title={`Assign “${game.name}”`} onClose={onClose} footer={<RetroGamingPCButton variant="cancel" label="Cancel" onPress={onClose} />}>
      <View className="gap-2">
        {assign.isError ? <RetroGamingPCAlert message={assign.error.message} /> : null}
        {nowPlaying.isPending ? (
          <RetroGamingPCSpinner label="Loading your slots…" />
        ) : (
          NOW_PLAYING_SLOTS.map((slot) => {
            const row = rows.find((r) => r.slot_index === slot);
            const current = row ? (titles.data?.get(row.game_id)?.name ?? `Game #${row.game_id}`) : null;
            const isArmed = armed === slot;
            return (
              <Pressable
                key={slot}
                accessibilityRole="button"
                accessibilityLabel={current ? `Replace ${current} in slot ${slot}` : `Put in empty slot ${slot}`}
                disabled={assign.isPending}
                onPress={() => choose(slot)}
                className={cn(
                  'flex-row items-center gap-2 border p-2',
                  isArmed ? 'border-retrogamingpc-error bg-retrogamingpc-dark' : 'border-retrogamingpc-accent bg-retrogamingpc-card',
                )}
              >
                <Text className="w-14 font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">SLOT {slot}</Text>
                <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text-bright" numberOfLines={1}>
                  {isArmed ? `Tap again to replace “${current}”` : (current ?? 'Empty')}
                </Text>
                {assign.isPending && assign.variables?.slot === slot ? <RetroGamingPCSpinner /> : null}
                {!current ? <RetroGamingPCBadge label="Free" variant="nowPlaying" /> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </RetroGamingPCModal>
  );
}

/**
 * Game page hero button: "Add to Now Playing" (opens the slot chooser), or, when the
 * game already sits in a slot, "Now Playing · Slot N" which opens the Review Studio.
 */
export function NowPlayingButton({ game }: { game: IgdbGameResult }) {
  const nowPlaying = useNowPlaying();
  const [choosing, setChoosing] = useState(false);
  const inSlot = nowPlaying.data?.find((r) => r.game_id === game.id);

  return (
    <>
      {inSlot ? (
        <RetroGamingPCButton variant="navigate" label={`Now Playing · Slot ${inSlot.slot_index}`} onPress={() => router.push('/post')} />
      ) : (
        <RetroGamingPCButton
          variant="create"
          label="Add to Now Playing"
          disabled={nowPlaying.isPending}
          onPress={() => setChoosing(true)}
        />
      )}
      <SlotChooserModal
        visible={choosing}
        game={game}
        onClose={() => setChoosing(false)}
        onAssigned={(slot) => {
          setChoosing(false);
          showToast(`Added to Now Playing slot ${slot}.`, 'success');
        }}
      />
    </>
  );
}
