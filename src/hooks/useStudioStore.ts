import { create } from 'zustand';

import type { IgdbGameResult } from '@/types/igdb';
import type { NowPlayingSlot } from '@/types/database.types';

/**
 * Review Studio UI state: which slot is selected and which modal is open.
 * Server data lives in TanStack Query; this store only holds ephemeral UI intent.
 */
export type StudioModal =
  | { kind: 'none' }
  /** Pick a game for a Now Playing slot (assign or swap). */
  | { kind: 'assign'; slot: NowPlayingSlot }
  /** Edit a slot's running notes & preliminary score. */
  | { kind: 'editSlot'; slot: NowPlayingSlot }
  /** Confirm clearing a slot. */
  | { kind: 'remove'; slot: NowPlayingSlot }
  /** Pick a game for a standalone quick review. */
  | { kind: 'pickReviewGame' };

/** What the Review Studio form is currently editing. */
export type StudioTarget = {
  gameId: number;
  /** Present when the review started from a Now Playing slot. */
  fromSlot?: NowPlayingSlot;
  /** Prefill values (from the slot's notes / preliminary score). */
  seed?: { rating: number | null; content: string };
};

type StudioState = {
  selectedSlot: NowPlayingSlot | null;
  modal: StudioModal;
  target: StudioTarget | null;
  selectSlot: (slot: NowPlayingSlot | null) => void;
  openModal: (modal: Exclude<StudioModal, { kind: 'none' }>) => void;
  closeModal: () => void;
  startReview: (target: StudioTarget) => void;
  /** Standalone quick review picked from the selector. */
  startQuickReview: (game: IgdbGameResult) => void;
  clearTarget: () => void;
};

export const useStudioStore = create<StudioState>()((set) => ({
  selectedSlot: null,
  modal: { kind: 'none' },
  target: null,
  selectSlot: (slot) => set({ selectedSlot: slot }),
  openModal: (modal) => set({ modal, selectedSlot: 'slot' in modal ? modal.slot : null }),
  closeModal: () => set({ modal: { kind: 'none' } }),
  startReview: (target) => set({ target, modal: { kind: 'none' } }),
  startQuickReview: (game) => set({ target: { gameId: game.id }, modal: { kind: 'none' } }),
  clearTarget: () => set({ target: null }),
}));
