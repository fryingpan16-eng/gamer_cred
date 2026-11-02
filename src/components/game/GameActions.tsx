import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SteamAlert, SteamBadge, SteamButton, SteamModal, SteamPanel, SteamSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useNowPlaying, useUpdateNowPlayingSlot } from '@/hooks/useNowPlaying';
import { useMyReviewForGame } from '@/hooks/useReviews';
import { useStudioStore } from '@/hooks/useStudioStore';
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
    <SteamModal visible={visible} title={`Assign “${game.name}”`} onClose={onClose} footer={<SteamButton label="Cancel" onPress={onClose} />}>
      <View className="gap-2">
        {assign.isError ? <SteamAlert message={assign.error.message} /> : null}
        {nowPlaying.isPending ? (
          <SteamSpinner label="Loading your slots…" />
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
                  isArmed ? 'border-steam-error bg-steam-dark' : 'border-steam-accent bg-steam-card',
                )}
              >
                <Text className="w-14 font-mono text-steam-xs text-steam-text-muted">SLOT {slot}</Text>
                <Text className="flex-1 text-steam-sm text-steam-text-bright" numberOfLines={1}>
                  {isArmed ? `Tap again to replace “${current}”` : (current ?? 'Empty')}
                </Text>
                {assign.isPending && assign.variables?.slot === slot ? <SteamSpinner /> : null}
                {!current ? <SteamBadge label="Free" variant="nowPlaying" /> : null}
              </Pressable>
            );
          })
        )}
      </View>
    </SteamModal>
  );
}

/** "Assign to Now Playing Slot" + "Write / Edit Review" for a game page. */
export function GameActions({ game }: { game: IgdbGameResult }) {
  const nowPlaying = useNowPlaying();
  const myReview = useMyReviewForGame(game.id);
  const startReview = useStudioStore((s) => s.startReview);
  const [choosing, setChoosing] = useState(false);
  const [assignedTo, setAssignedTo] = useState<NowPlayingSlot | null>(null);

  const inSlot = nowPlaying.data?.find((r) => r.game_id === game.id);
  const review = myReview.data;

  const openStudio = () => {
    startReview({
      gameId: game.id,
      fromSlot: inSlot?.slot_index,
      // Seed from Now Playing notes only when there is no saved review to resume.
      seed: !review && inSlot ? { rating: inSlot.preliminary_score, content: inSlot.notes ?? '' } : undefined,
    });
    router.push('/post');
  };

  return (
    <SteamPanel title="Your Library">
      <View className="gap-2">
        {assignedTo ? <SteamAlert tone="info" message={`Added to Now Playing slot ${assignedTo}.`} /> : null}
        <View className="flex-row flex-wrap gap-1">
          {inSlot ? <SteamBadge label={`Now Playing · Slot ${inSlot.slot_index}`} variant="nowPlaying" /> : null}
          {review ? <SteamBadge label={review.status === 'published' ? 'Reviewed' : 'Draft saved'} variant={review.status === 'published' ? 'published' : 'draft'} /> : null}
        </View>
        {inSlot ? (
          <SteamButton label="Open in Review Studio" onPress={() => router.push('/post')} />
        ) : (
          <SteamButton label="Assign to Now Playing Slot" variant="primary" onPress={() => setChoosing(true)} />
        )}
        <SteamButton
          label={review ? (review.status === 'published' ? 'Edit Review' : 'Resume Draft') : 'Write Review'}
          variant={inSlot ? 'primary' : 'default'}
          loading={myReview.isPending}
          onPress={openStudio}
        />
      </View>
      <SlotChooserModal
        visible={choosing}
        game={game}
        onClose={() => setChoosing(false)}
        onAssigned={(slot) => {
          setChoosing(false);
          setAssignedTo(slot);
        }}
      />
    </SteamPanel>
  );
}
