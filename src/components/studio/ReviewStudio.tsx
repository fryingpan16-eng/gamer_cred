import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Thumbnail } from '@/components/search/Thumbnail';
import {
  SteamAlert,
  SteamBadge,
  SteamButton,
  SteamConfirmModal,
  SteamInput,
  SteamPanel,
  SteamScoreMeter,
  SteamSpinner,
  SteamTabs,
  type SteamTabItem,
} from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useDeleteReview, useMyReviewForGame, useSaveReview } from '@/hooks/useReviews';
import { useStudioStore, type StudioTarget } from '@/hooks/useStudioStore';
import type { Review, ReviewStatus } from '@/types/database.types';
import { igdbImageUrl } from '@/types/igdb';
import { cn } from '@/utils/cn';
import { REVIEW_MAX_LENGTH, reviewFormSchema, type ReviewFormValues } from '@/utils/reviewSchemas';

import { GamePickerModal } from './GamePickerModal';

const STATUS_TABS: readonly SteamTabItem<ReviewStatus>[] = [
  { key: 'draft', label: 'Save as Draft' },
  { key: 'published', label: 'Publish' },
];

type FieldErrors = Partial<Record<keyof ReviewFormValues, string>>;

function Checkbox({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      className="flex-row items-center gap-2"
    >
      <View className="steam-bevel-inset h-4 w-4 items-center justify-center bg-steam-dark">
        {checked ? <Text className="text-steam-xs font-bold text-steam-highlight">✓</Text> : null}
      </View>
      <Text className="text-steam-sm text-steam-text">{label}</Text>
    </Pressable>
  );
}

type EditorProps = { target: StudioTarget; existing: Review | null };

/** Keyed by game + existing review version, so initial values never need effect-syncing. */
function ReviewEditor({ target, existing }: EditorProps) {
  const clearTarget = useStudioStore((s) => s.clearTarget);
  const save = useSaveReview();
  const remove = useDeleteReview();

  const [rating, setRating] = useState<number | null>(existing?.rating ?? target.seed?.rating ?? null);
  const [content, setContent] = useState(existing?.content ?? target.seed?.content ?? '');
  const [status, setStatus] = useState<ReviewStatus>(existing?.status ?? 'draft');
  const [freeSlot, setFreeSlot] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAs, setSavedAs] = useState<ReviewStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isPublished = existing?.status === 'published';
  const unpublishing = isPublished && status === 'draft';

  const submit = () => {
    setSavedAs(null);
    const parsed = reviewFormSchema.safeParse({ gameId: target.gameId, rating, content, status });
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
      {save.isError ? <SteamAlert message={save.error.message} /> : null}
      {remove.isError ? <SteamAlert message={remove.error.message} /> : null}
      {savedAs ? (
        <SteamAlert
          tone="info"
          message={savedAs === 'published' ? 'Review published to the community feed.' : 'Draft saved to your backlog notes.'}
        />
      ) : null}

      <SteamScoreMeter
        label={status === 'published' ? 'Score (required to publish)' : 'Score'}
        value={rating}
        onChange={(v) => {
          setRating(v);
          setFieldErrors((e) => ({ ...e, rating: undefined }));
        }}
        error={fieldErrors.rating}
      />

      <SteamInput
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
        hint={`${content.length.toLocaleString()} / ${REVIEW_MAX_LENGTH.toLocaleString()} · score-only quick reviews are fine`}
        editable={!save.isPending}
      />

      <SteamTabs items={STATUS_TABS} value={status} onChange={setStatus} fill />

      {unpublishing ? (
        <SteamAlert tone="info" message="Saving as a draft removes this review from the community feed." />
      ) : null}
      {status === 'published' && target.fromSlot ? (
        <Checkbox
          checked={freeSlot}
          onToggle={() => setFreeSlot((v) => !v)}
          label={`Free up Now Playing slot ${target.fromSlot} after publishing`}
        />
      ) : null}

      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <View className="flex-row gap-2">
          <SteamButton label="Close" onPress={clearTarget} disabled={save.isPending} />
          {existing ? (
            <SteamButton label="Delete" variant="danger" onPress={() => setConfirmDelete(true)} disabled={save.isPending} />
          ) : null}
        </View>
        <SteamButton label={submitLabel} variant="primary" loading={save.isPending} onPress={submit} />
      </View>

      <SteamConfirmModal
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

/** Review Studio: write a review from a Now Playing slot, or a standalone quick review. */
export function ReviewStudio() {
  const { target, modal, openModal, closeModal, startQuickReview } = useStudioStore();
  const gameId = target?.gameId ?? null;
  const games = useGameLookup(gameId ? [gameId] : []);
  const existing = useMyReviewForGame(gameId);
  const game = gameId ? games.data?.get(gameId) : undefined;

  return (
    <SteamPanel
      title="Review Studio"
      headerRight={
        existing.data ? (
          <SteamBadge label={existing.data.status === 'published' ? 'Published' : 'Draft'} variant={existing.data.status === 'published' ? 'published' : 'draft'} />
        ) : undefined
      }
    >
      {!target ? (
        <View className="gap-3">
          <Text className="text-steam-sm text-steam-text">
            Hit <Text className="font-bold text-steam-text-bright">Review</Text> on a Now Playing slot to turn your notes
            into a review, or rate any game directly with a quick review.
          </Text>
          <View className="flex-row justify-end">
            <SteamButton label="Quick Review a Game…" variant="primary" onPress={() => openModal({ kind: 'pickReviewGame' })} />
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
              <Text className="text-steam-lg font-bold text-steam-text-bright" numberOfLines={2}>
                {game?.name ?? (games.isFetching ? 'Loading…' : `Game #${target.gameId}`)}
              </Text>
              <Text className={cn('text-steam-xs text-steam-text-muted')}>
                {target.fromSlot ? `From Now Playing slot ${target.fromSlot}` : 'Quick review'}
                {game?.releaseYear ? ` · ${game.releaseYear}` : ''}
              </Text>
            </View>
            <SteamButton label="Change" onPress={() => openModal({ kind: 'pickReviewGame' })} />
          </View>

          {existing.isPending ? (
            <SteamSpinner label="Checking for an existing review…" />
          ) : existing.isError ? (
            <SteamAlert message={existing.error.message} />
          ) : (
            <ReviewEditor
              // Remount only when the subject changes — not after a save, so success feedback survives.
              key={`${target.gameId}:${target.fromSlot ?? 'quick'}`}
              target={target}
              existing={existing.data}
            />
          )}
        </View>
      )}

      <GamePickerModal
        visible={modal.kind === 'pickReviewGame'}
        title="Choose a game to review"
        currentGameId={gameId}
        onClose={closeModal}
        onPick={startQuickReview}
      />
    </SteamPanel>
  );
}
