import { router } from 'expo-router';

import { RetroGamingPCButton } from '@/components/ui';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useMyReviewsForGame } from '@/hooks/useReviews';
import { useStudioStore } from '@/hooks/useStudioStore';
import { slotRating } from '@/utils/ratingColumns';

/**
 * The game page's only review entry point: opens the Review Studio for this
 * game. With a published review, the Studio asks whether to edit it or write a
 * replay review (migration 000040). (Quick ratings never lead here — see
 * src/components/rating/README.md.)
 */
export function WriteReviewButton({ gameId }: { gameId: number }) {
  const nowPlaying = useNowPlaying();
  const mine = useMyReviewsForGame(gameId);
  const startReview = useStudioStore((s) => s.startReview);
  const inSlot = nowPlaying.data?.find((r) => r.game_id === gameId);
  const draft = mine.data?.draft ?? null;
  const published = mine.data?.latestPublished ?? null;

  const open = () => {
    startReview({
      gameId,
      fromSlot: inSlot?.slot_index,
      // Seed from Now Playing notes only when there is no saved review to resume.
      seed: !draft && !published && inSlot ? { rating: slotRating(inSlot), content: inSlot.notes ?? '' } : undefined,
    });
    router.push('/post');
  };

  return (
    <RetroGamingPCButton
      variant="create"
      label={draft ? 'Resume review draft' : published ? 'Edit or review again' : 'Write a review'}
      loading={mine.isPending}
      onPress={open}
    />
  );
}
