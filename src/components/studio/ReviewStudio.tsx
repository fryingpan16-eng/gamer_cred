import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCCheckbox,
  RetroGamingPCConfirmModal,
  RetroGamingPCInput,
  RetroGamingPCPanel,
  RetroGamingPCRatingInput,
  RetroGamingPCSheet,
  RetroGamingPCSpinner,
} from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useAuthStore, usePrimaryRatingScale } from '@/hooks/useAuth';
import { usePlatforms } from '@/hooks/useProfile';
import { useMyGameRating } from '@/hooks/useRatings';
import { useDeleteReview, useMyReviewForGame, useSaveReview } from '@/hooks/useReviews';
import { useStudioStore, type StudioTarget } from '@/hooks/useStudioStore';
import type { GameRatingEntry } from '@/services/ratings';
import type { Review, ReviewStatus } from '@/types/database.types';
import { igdbImageUrl } from '@/types/igdb';
import { cn } from '@/utils/cn';
import type { StoredRating } from '@/utils/rating';
import { reviewRating } from '@/utils/ratingColumns';
import { REVIEW_MAX_LENGTH, reviewFormSchema, type ReviewFormValues } from '@/utils/reviewSchemas';

import { GamePickerModal } from './GamePickerModal';
import { PlatformPicker } from './PlatformPicker';

type FieldErrors = Partial<Record<keyof ReviewFormValues, string>>;

type EditorProps = {
  target: StudioTarget;
  existing: Review | null;
  /** The viewer's quick rating for this game — the starting score and platform for a new review. */
  quickRating: GameRatingEntry | null;
  /** Close / Delete done: asks the parent to close (it confirms if there are unsaved changes). */
  onRequestClose: () => void;
  /** Called whenever the form starts or stops differing from what was last saved. */
  onDirtyChange: (dirty: boolean) => void;
};

/** Keyed by game + existing review version, so initial values never need effect-syncing. */
function ReviewEditor({ target, existing, quickRating, onRequestClose, onDirtyChange }: EditorProps) {
  const clearTarget = useStudioStore((s) => s.clearTarget);
  const save = useSaveReview();
  const remove = useDeleteReview();

  const primaryScale = usePrimaryRatingScale();
  // One score per game: start from the review's score, else your quick rating, else the Now Playing
  // "so far" score. Untouched ratings are saved back exactly as stored.
  const [rating, setRating] = useState<StoredRating | null>(
    (existing ? reviewRating(existing) : null) ?? quickRating ?? target.seed?.rating ?? null,
  );
  const [content, setContent] = useState(existing?.content ?? target.seed?.content ?? '');
  // undefined = untouched: an existing review keeps its platform; a new one uses your quick rating's
  // platform, else your Main platform.
  const [platformChoice, setPlatformChoice] = useState<number | null | undefined>(existing ? existing.platform_id : undefined);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const roster = usePlatforms(viewerId);
  const mainPlatformId = roster.data?.find((r) => r.is_main)?.platform_id ?? null;
  const platformId = platformChoice === undefined ? (quickRating?.platformId ?? mainPlatformId) : platformChoice;
  const [freeSlot, setFreeSlot] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAs, setSavedAs] = useState<ReviewStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);

  // Unsaved changes = the form differs from what it opened with, or from the last save.
  const snapshot = JSON.stringify([rating, content, platformId]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const isPublished = existing?.status === 'published';
  // Which button's save is running (for its spinner).
  const savingAs = save.isPending ? save.variables.status : null;

  const submit = (status: ReviewStatus) => {
    setConfirmUnpublish(false);
    setSavedAs(null);
    const parsed = reviewFormSchema.safeParse({ gameId: target.gameId, rating, content, status, platformId });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof ReviewFormValues | undefined;
        if (key && next[key] === undefined) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    save.mutate(
      {
        ...parsed.data,
        clearSlot: parsed.data.status === 'published' && target.fromSlot && freeSlot ? target.fromSlot : undefined,
      },
      {
        onSuccess: (review) => {
          setSavedAs(review.status);
          setSavedSnapshot(snapshot);
        },
      },
    );
  };

  return (
    <View className="gap-3">
      {save.isError ? <RetroGamingPCAlert message={save.error.message} /> : null}
      {remove.isError ? <RetroGamingPCAlert message={remove.error.message} /> : null}
      {savedAs ? (
        <RetroGamingPCAlert
          tone="success"
          message={savedAs === 'published' ? 'Review published to the community feed.' : 'Draft saved to your backlog notes.'}
        />
      ) : null}

      <RetroGamingPCRatingInput
        label="Rating (required to publish)"
        scale={primaryScale}
        value={rating}
        onChange={(v) => {
          setRating(v);
          setFieldErrors((e) => ({ ...e, rating: undefined }));
        }}
        error={fieldErrors.rating}
      />
      <Text className="-mt-2 text-retrogamingpc-xs text-retrogamingpc-text-muted">
        This is your one score for the game: it is also your quick rating, and changing either changes both.
      </Text>

      <RetroGamingPCInput
        label="Review"
        value={content}
        onChangeText={(v) => {
          setContent(v);
          setFieldErrors((e) => ({ ...e, content: undefined }));
        }}
        multiline
        maxLength={REVIEW_MAX_LENGTH}
        placeholder="What worked, what didn’t, who should play it… (or quick notes to finish later)"
        error={fieldErrors.content}
        hint={`${content.length.toLocaleString()} / ${REVIEW_MAX_LENGTH.toLocaleString()}`}
        editable={!save.isPending}
      />

      <PlatformPicker value={platformId} onChange={setPlatformChoice} error={fieldErrors.platformId} />

      {!isPublished && target.fromSlot ? (
        <RetroGamingPCCheckbox
          checked={freeSlot}
          onToggle={() => setFreeSlot((v) => !v)}
          label={`Free up Now Playing slot ${target.fromSlot} when publishing`}
        />
      ) : null}

      {/* One action bar: leave on the left, save actions on the right. */}
      <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-t-retrogamingpc-accent pt-3">
        <View className="flex-row gap-2">
          <RetroGamingPCButton variant="cancel" label="Close" onPress={onRequestClose} disabled={save.isPending} />
          {existing ? (
            <RetroGamingPCButton label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} disabled={save.isPending} />
          ) : null}
        </View>
        <View className="flex-row flex-wrap justify-end gap-2">
          {isPublished ? (
            <RetroGamingPCButton
              label="Unpublish"
              loading={savingAs === 'draft'}
              disabled={save.isPending}
              onPress={() => setConfirmUnpublish(true)}
            />
          ) : (
            <RetroGamingPCButton
              label="Save Draft"
              loading={savingAs === 'draft'}
              disabled={save.isPending}
              onPress={() => submit('draft')}
            />
          )}
          <RetroGamingPCButton
            variant="save"
            label={isPublished ? 'Update Review' : 'Publish'}
            loading={savingAs === 'published'}
            disabled={save.isPending}
            onPress={() => submit('published')}
          />
        </View>
      </View>

      <RetroGamingPCConfirmModal
        visible={confirmUnpublish}
        title="Unpublish review?"
        message="This takes your review off the community feed and keeps it as a draft. You can publish it again later."
        confirmLabel="Unpublish"
        busy={save.isPending}
        onCancel={() => setConfirmUnpublish(false)}
        onConfirm={() => submit('draft')}
      />

      <RetroGamingPCConfirmModal
        visible={confirmDelete}
        title={isPublished ? 'Delete review' : 'Discard draft'}
        message={isPublished ? 'Delete this published review? This cannot be undone.' : 'Discard this draft and its notes?'}
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          existing &&
          remove.mutate(existing.id, {
            onSuccess: () => {
              setConfirmDelete(false);
              clearTarget();
            },
            onError: () => setConfirmDelete(false),
          })
        }
      />
    </View>
  );
}

/**
 * Review Studio: the place full reviews are written — from a Now Playing slot,
 * a draft, the game page's "Write a review" button, or "Review a Game…".
 * The writer opens as an overlay pinned to the top of the screen, so the keyboard
 * never covers the text you are typing. (Quick star ratings never come through here.)
 */
export function ReviewStudio() {
  const { target, modal, openModal, closeModal, startStandaloneReview, clearTarget } = useStudioStore();
  const gameId = target?.gameId ?? null;
  const games = useGameLookup(gameId ? [gameId] : []);
  const existing = useMyReviewForGame(gameId);
  const quick = useMyGameRating(gameId);
  const game = gameId ? games.data?.get(gameId) : undefined;
  const dirtyRef = useRef(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);
  const close = () => {
    dirtyRef.current = false;
    setConfirmDiscard(false);
    clearTarget();
  };
  const requestClose = () => {
    if (dirtyRef.current) setConfirmDiscard(true);
    else close();
  };
  const pickGame = () => openModal({ kind: 'pickReviewGame' });
  const picker = (visible: boolean) => (
    <GamePickerModal
      visible={visible}
      title="Choose a game to review"
      currentGameId={gameId}
      onClose={closeModal}
      onPick={(picked) => {
        dirtyRef.current = false;
        startStandaloneReview(picked);
      }}
    />
  );

  return (
    <RetroGamingPCPanel title="Review Studio">
      <View className="gap-3">
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
          Hit <Text className="font-bold text-retrogamingpc-text-bright">Review</Text> on a Now Playing slot to turn your notes
          into a review, or write a review for any game.
        </Text>
        <View className="flex-row justify-end">
          <RetroGamingPCButton variant="create" label="Review a Game…" onPress={pickGame} />
        </View>
      </View>
      {/* With the writer open, the picker must live inside it to show on top. */}
      {picker(modal.kind === 'pickReviewGame' && !target)}

      <RetroGamingPCSheet
        visible={target !== null}
        title="Review Studio"
        onClose={requestClose}
        headerRight={
          existing.data ? (
            <RetroGamingPCBadge
              label={existing.data.status === 'published' ? 'Published' : 'Draft'}
              variant={existing.data.status === 'published' ? 'published' : 'draft'}
            />
          ) : undefined
        }
      >
        {target ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <Thumbnail
                uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
                fallback={game?.name ?? '?'}
                shape="cover"
                accessibilityLabel={`${game?.name ?? 'Game'} cover`}
              />
              <View className="flex-1 gap-0.5">
                <Text className="text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright" numberOfLines={2}>
                  {game?.name ?? (games.isFetching ? 'Loading…' : `Game #${target.gameId}`)}
                </Text>
                <Text className={cn('text-retrogamingpc-xs text-retrogamingpc-text-muted')}>
                  {target.fromSlot ? `From Now Playing slot ${target.fromSlot}` : 'Review'}
                  {game?.releaseYear ? ` · ${game.releaseYear}` : ''}
                </Text>
              </View>
              <RetroGamingPCButton label="Change" onPress={pickGame} />
            </View>

            {existing.isPending || quick.isPending ? (
              <RetroGamingPCSpinner label="Checking for an existing review…" />
            ) : existing.isError ? (
              <RetroGamingPCAlert message={existing.error.message} />
            ) : (
              <ReviewEditor
                // Remount only when the subject changes — not after a save, so success feedback survives.
                key={`${target.gameId}:${target.fromSlot ?? 'quick'}`}
                target={target}
                existing={existing.data}
                quickRating={quick.rating}
                onRequestClose={requestClose}
                onDirtyChange={setDirty}
              />
            )}
          </View>
        ) : null}

        {picker(modal.kind === 'pickReviewGame' && target !== null)}
        <RetroGamingPCConfirmModal
          visible={confirmDiscard}
          title="Discard changes?"
          message="You have unsaved changes to this review. Close without saving?"
          confirmLabel="Discard"
          cancelLabel="Keep writing"
          destructive
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={close}
        />
      </RetroGamingPCSheet>
    </RetroGamingPCPanel>
  );
}
