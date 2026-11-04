import { useMemo } from 'react';
import { View } from 'react-native';

import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCConfirmModal,
  RetroGamingPCPanel,
  RetroGamingPCSpinner,
} from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useNowPlaying, useRemoveNowPlayingSlot, useUpdateNowPlayingSlot } from '@/hooks/useNowPlaying';
import { useMemberId } from '@/hooks/useAuth';
import { useBacklog } from '@/hooks/useBacklog';
import { useStudioStore } from '@/hooks/useStudioStore';
import { NOW_PLAYING_SLOTS } from '@/services/nowPlaying';
import type { NowPlaying, NowPlayingSlot } from '@/types/database.types';
import { slotRating } from '@/utils/ratingColumns';

import { GamePickerModal } from './GamePickerModal';
import { NowPlayingSlotCard } from './NowPlayingSlotCard';
import { SlotEditorModal } from './SlotEditorModal';

/** The interactive 4-slot Now Playing grid plus its assign / edit / remove dialogs. */
export function NowPlayingGrid() {
  const nowPlaying = useNowPlaying();
  const rows = useMemo(() => nowPlaying.data ?? [], [nowPlaying.data]);
  const games = useGameLookup(rows.map((r) => r.game_id));
  const updateSlot = useUpdateNowPlayingSlot();
  const removeSlot = useRemoveNowPlayingSlot();

  const backlog = useBacklog(useMemberId());
  const { modal, selectedSlot, openModal, closeModal, startReview } = useStudioStore();

  const rowBySlot = useMemo(() => {
    const map = new Map<NowPlayingSlot, NowPlaying>();
    for (const row of rows) map.set(row.slot_index, row);
    return map;
  }, [rows]);

  const titleFor = (slot: NowPlayingSlot) => {
    const row = rowBySlot.get(slot);
    return row ? (games.data?.get(row.game_id)?.name ?? `Game #${row.game_id}`) : `Slot ${slot}`;
  };

  // A game can occupy only one slot (DB: now_playing_unique_game).
  const unavailableFor = (slot: NowPlayingSlot) =>
    new Map(rows.filter((r) => r.slot_index !== slot).map((r) => [r.game_id, `In slot ${r.slot_index}`] as const));

  const modalSlot = modal.kind === 'assign' || modal.kind === 'editSlot' || modal.kind === 'remove' ? modal.slot : null;
  const filledCount = rows.length;
  const mutationError = updateSlot.error?.message ?? removeSlot.error?.message ?? null;

  return (
    <RetroGamingPCPanel
      title="Now Playing"
      headerRight={<RetroGamingPCBadge label={`${filledCount}/4 active`} variant={filledCount > 0 ? 'nowPlaying' : 'draft'} />}
    >
      {nowPlaying.isPending ? (
        <RetroGamingPCSpinner label="Loading your slots…" />
      ) : nowPlaying.isError ? (
        <View className="gap-2">
          <RetroGamingPCAlert message={nowPlaying.error.message} />
          <View className="flex-row justify-end">
            <RetroGamingPCButton label="Retry" onPress={() => void nowPlaying.refetch()} />
          </View>
        </View>
      ) : (
        <View className="gap-2">
          {mutationError ? <RetroGamingPCAlert message={mutationError} /> : null}
          {games.isError ? (
            <RetroGamingPCAlert
              tone="info"
              message="Couldn't load some game details. Titles will appear when the game database is reachable."
            />
          ) : null}
          {/* 2×2 on phones, 4 across on desktop. Fixed widths keep the grid stable while data loads. */}
          <View className="flex-row flex-wrap gap-2">
            {NOW_PLAYING_SLOTS.map((slot) => {
              const row = rowBySlot.get(slot);
              return (
                <View key={slot} className="w-[48%] md:w-[23.5%]">
                  <NowPlayingSlotCard
                    slot={slot}
                    row={row}
                    game={row ? games.data?.get(row.game_id) : undefined}
                    gameLoading={games.isPending && games.fetchStatus === 'fetching'}
                    selected={selectedSlot === slot}
                    onAssign={() => openModal({ kind: 'assign', slot })}
                    onEdit={() => openModal({ kind: 'editSlot', slot })}
                    onRemove={() => openModal({ kind: 'remove', slot })}
                    onReview={() =>
                      row &&
                      startReview({
                        gameId: row.game_id,
                        fromSlot: slot,
                        seed: { rating: slotRating(row), content: row.notes ?? '' },
                      })
                    }
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}

      <GamePickerModal
        visible={modal.kind === 'assign'}
        title={modalSlot && rowBySlot.has(modalSlot) ? `Swap game — Slot ${modalSlot}` : `Add game — Slot ${modalSlot ?? ''}`}
        currentGameId={modalSlot ? rowBySlot.get(modalSlot)?.game_id : null}
        unavailable={modalSlot ? unavailableFor(modalSlot) : undefined}
        suggestions={{
          title: 'Your backlog',
          gameIds: backlog.data?.gameIds ?? [],
          emptyText: 'Your backlog is empty. Search for any game above, or add games to your backlog to see them here first.',
        }}
        onClose={closeModal}
        onPick={(game) => {
          if (modalSlot === null) return;
          const current = rowBySlot.get(modalSlot);
          closeModal();
          if (current?.game_id !== game.id) updateSlot.mutate({ slot: modalSlot, gameId: game.id });
        }}
      />

      <SlotEditorModal
        visible={modal.kind === 'editSlot'}
        row={modalSlot ? rowBySlot.get(modalSlot) : undefined}
        gameTitle={modalSlot ? titleFor(modalSlot) : ''}
        saving={updateSlot.isPending}
        error={modal.kind === 'editSlot' ? (updateSlot.error?.message ?? null) : null}
        onClose={closeModal}
        onSave={(details) => {
          if (modalSlot === null) return;
          updateSlot.mutate({ slot: modalSlot, details }, { onSuccess: closeModal });
        }}
      />

      <RetroGamingPCConfirmModal
        visible={modal.kind === 'remove'}
        title="Remove from Now Playing"
        message={`Remove ${modalSlot ? titleFor(modalSlot) : 'this game'} from slot ${modalSlot ?? ''}? Its running notes and preliminary rating will be discarded. Write a review first if you want to keep them.`}
        confirmLabel="Remove"
        destructive
        busy={removeSlot.isPending}
        onCancel={closeModal}
        onConfirm={() => {
          if (modalSlot !== null) removeSlot.mutate(modalSlot, { onSettled: closeModal });
        }}
      />
    </RetroGamingPCPanel>
  );
}
