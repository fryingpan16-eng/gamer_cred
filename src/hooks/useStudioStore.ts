import { create } from 'zustand';

import type { IgdbGameResult } from '@/types/igdb';
import type { NowPlayingSlot } from '@/types/database.types';
import type { StoredRating } from '@/utils/rating';

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
  /** Pick a game to review (Review Studio "Review a Game…"). */
  | { kind: 'pickReviewGame' };

/** What the Review Studio form is currently editing. */
export type StudioTarget = {
  gameId: number;
  /** Present when the review started from a Now Playing slot. */
  fromSlot?: NowPlayingSlot;
  /** Prefill values (from the slot's notes / preliminary score). */
  seed?: { rating: StoredRating | null; content: string };
  /** Edit this review. Without it (and without newReview), the Studio resumes your draft, or asks when you've published one. */
  reviewId?: string;
  /** Write a new review: a replay review when you've reviewed the game before (migration 000040). */
  newReview?: boolean;
  /** Bumped on every start/choice: the editor remounts only when this changes. */
  nonce: number;
};

export type StudioStart = Omit<StudioTarget, 'nonce'>;

type StudioState = {
  selectedSlot: NowPlayingSlot | null;
  modal: StudioModal;
  target: StudioTarget | null;
  selectSlot: (slot: NowPlayingSlot | null) => void;
  openModal: (modal: Exclude<StudioModal, { kind: 'none' }>) => void;
  closeModal: () => void;
  startReview: (target: StudioStart) => void;
  /** Edit or new-review choice for a game you've reviewed before. */
  chooseReview: (choice: { reviewId: string } | { newReview: true }) => void;
  /** After the first save of a new review: keep editing that review (same editor, no remount). */
  pinReview: (reviewId: string) => void;
  /** Standalone review (not from a Now Playing slot) picked from the selector. */
  startStandaloneReview: (game: IgdbGameResult) => void;
  clearTarget: () => void;
};

let nonce = 0;

export const useStudioStore = create<StudioState>()((set) => ({
  selectedSlot: null,
  modal: { kind: 'none' },
  target: null,
  selectSlot: (slot) => set({ selectedSlot: slot }),
  openModal: (modal) => set({ modal, selectedSlot: 'slot' in modal ? modal.slot : null }),
  closeModal: () => set({ modal: { kind: 'none' } }),
  startReview: (target) => set({ target: { ...target, nonce: ++nonce }, modal: { kind: 'none' } }),
  chooseReview: (choice) =>
    set((s) =>
      s.target
        ? {
            target: {
              ...s.target,
              reviewId: 'reviewId' in choice ? choice.reviewId : undefined,
              newReview: 'newReview' in choice,
              nonce: ++nonce,
            },
          }
        : {},
    ),
  pinReview: (reviewId) => set((s) => (s.target ? { target: { ...s.target, reviewId, newReview: false } } : {})),
  startStandaloneReview: (game) => set({ target: { gameId: game.id, nonce: ++nonce }, modal: { kind: 'none' } }),
  clearTarget: () => set({ target: null }),
}));
