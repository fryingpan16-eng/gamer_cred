import { useState } from 'react';
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
  RetroGamingPCSpinner,
  RetroGamingPCTabs,
  type RetroGamingPCTabItem,
} from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useAuthStore, usePrimaryRatingScale } from '@/hooks/useAuth';
import { usePlatforms } from '@/hooks/useProfile';
import { useMyGameRating } from '@/hooks/useRatings';
import { useDeleteReview, useMyReviewForGame, useSaveReview } from '@/hooks/useReviews';
import { useStudioStore, type StudioTarget } from '@/hooks/useStudioStore';
import type { Review, ReviewStatus } from '@/types/database.types';
import { igdbImageUrl } from '@/types/igdb';
import { cn } from '@/utils/cn';
import type { StoredRating } from '@/utils/rating';
import { reviewRating } from '@/utils/ratingColumns';
import { REVIEW_MAX_LENGTH, reviewFormSchema, type ReviewFormValues } from '@/utils/reviewSchemas';

import { GamePickerModal } from './GamePickerModal';
import { PlatformPicker } from './PlatformPicker';

const STATUS_TABS: readonly RetroGamingPCTabItem<ReviewStatus>[] = [
  { key: 'draft', label: 'Save as Draft' },
  { key: 'published', label: 'Publish' },
];

type FieldErrors = Partial<Record<keyof ReviewFormValues, string>>;

type EditorProps = {
  target: StudioTarget;
  existing: Review | null;
  /** The viewer's quick rating for this game — the starting score for a new review. */
  quickRating: StoredRating | null;
};

/** Keyed by game + existing review version, so initial values never need effect-syncing. */
function ReviewEditor({ target, existing, quickRating }: EditorProps) {
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
  // undefined = untouched: an existing review keeps its platform; a new one defaults to your Main platform.
  const [platformChoice, setPlatformChoice] = useState<number | null | undefined>(existing ? existing.platform_id : undefined);
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const roster = usePlatforms(viewerId);
  const mainPlatformId = roster.data?.find((r) => r.is_main)?.platform_id ?? null;
  const platformId = platformChoice === undefined ? mainPlatformId : platformChoice;
  const [status, setStatus] = useState<ReviewStatus>(existing?.status ?? 'draft');
  const [freeSlot, setFreeSlot] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAs, setSavedAs] = useState<ReviewStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isPublished = existing?.status === 'published';
  const unpublishing = isPublished && status === 'draft';

  const submit = () => {
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
      { onSuccess: (review) => setSavedAs(review.status) },
    );
  };

  const submitLabel =
    status === 'draft' ? (unpublishing ? 'Unpublish & Save Draft' : 'Save Draft') : isPublished ? 'Update Review' : 'Publish Review';

  return (
    <View className="gap-3">
      {save.isError ? <RetroGamingPCAlert message={save.error.message} /> : null}
      {remove.isError ? <RetroGamingPCAlert message={remove.error.message} /> : null}
      {savedAs ? (
        <RetroGamingPCAlert
          tone="info"
          message={savedAs === 'published' ? 'Review published to the community feed.' : 'Draft saved to your backlog notes.'}
        />
      ) : null}

      <RetroGamingPCRatingInput
        label={status === 'published' ? 'Rating (required to publish)' : 'Rating'}
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
        label={status === 'published' ? 'Review' : 'Backlog notes'}
        value={content}
        onChangeText={(v) => {
          setContent(v);
          setFieldErrors((e) => ({ ...e, content: undefined }));
        }}
        multiline
        maxLength={REVIEW_MAX_LENGTH}
        placeholder={status === 'published' ? 'What worked, what didn’t, who should play it…' : 'Quick thoughts to come back to…'}
        error={fieldErrors.content}
        hint={`${content.length.toLocaleString()} / ${REVIEW_MAX_LENGTH.toLocaleString()}`}
        editable={!save.isPending}
      />

      <PlatformPicker value={platformId} onChange={setPlatformChoice} error={fieldErrors.platformId} />

      <RetroGamingPCTabs items={STATUS_TABS} value={status} onChange={setStatus} fill />

      {unpublishing ? (
        <RetroGamingPCAlert tone="info" message="Saving as a draft removes this review from the community feed." />
      ) : null}
      {status === 'published' && target.fromSlot ? (
        <RetroGamingPCCheckbox
          checked={freeSlot}
          onToggle={() => setFreeSlot((v) => !v)}
          label={`Free up Now Playing slot ${target.fromSlot} after publishing`}
        />
      ) : null}

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row gap-2">
          <RetroGamingPCButton label="Close" onPress={clearTarget} disabled={save.isPending} />
          {existing ? (
            <RetroGamingPCButton label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} disabled={save.isPending} />
          ) : null}
        </View>
        <RetroGamingPCButton label={submitLabel} variant="primary" loading={save.isPending} onPress={submit} />
      </View>

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
 * (Quick star ratings are separate and never come through here.)
 */
export function ReviewStudio() {
  const { target, modal, openModal, closeModal, startStandaloneReview } = useStudioStore();
  const gameId = target?.gameId ?? null;
  const games = useGameLookup(gameId ? [gameId] : []);
  const existing = useMyReviewForGame(gameId);
  const quick = useMyGameRating(gameId);
  const game = gameId ? games.data?.get(gameId) : undefined;

  return (
    <RetroGamingPCPanel
      title="Review Studio"
      headerRight={
        existing.data ? (
          <RetroGamingPCBadge label={existing.data.status === 'published' ? 'Published' : 'Draft'} variant={existing.data.status === 'published' ? 'published' : 'draft'} />
        ) : undefined
      }
    >
      {!target ? (
        <View className="gap-3">
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
            Hit <Text className="font-bold text-retrogamingpc-text-bright">Review</Text> on a Now Playing slot to turn your notes
            into a review, or write a review for any game.
          </Text>
          <View className="flex-row justify-end">
            <RetroGamingPCButton label="Review a Game…" variant="primary" onPress={() => openModal({ kind: 'pickReviewGame' })} />
          </View>
        </View>
      ) : (
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
            <RetroGamingPCButton label="Change" onPress={() => openModal({ kind: 'pickReviewGame' })} />
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
            />
          )}
        </View>
      )}

      <GamePickerModal
        visible={modal.kind === 'pickReviewGame'}
        title="Choose a game to review"
        currentGameId={gameId}
        onClose={closeModal}
        onPick={startStandaloneReview}
      />
    </RetroGamingPCPanel>
  );
}
