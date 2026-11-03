import { router } from 'expo-router';

import { RetroGamingPCButton } from '@/components/ui';
import { useNowPlaying } from '@/hooks/useNowPlaying';
import { useMyReviewForGame } from '@/hooks/useReviews';
import { useStudioStore } from '@/hooks/useStudioStore';
import { slotRating } from '@/utils/ratingColumns';

/**
 * The game page's only review entry point: opens the Review Studio for this
 * game. (Quick ratings never lead here — see src/components/rating/README.md.)
 */
export function WriteReviewButton({ gameId }: { gameId: number }) {
  const nowPlaying = useNowPlaying();
  const myReview = useMyReviewForGame(gameId);
  const startReview = useStudioStore((s) => s.startReview);
  const inSlot = nowPlaying.data?.find((r) => r.game_id === gameId);
  const review = myReview.data;

  const open = () => {
    startReview({
      gameId,
      fromSlot: inSlot?.slot_index,
      // Seed from Now Playing notes only when there is no saved review to resume.
      seed: !review && inSlot ? { rating: slotRating(inSlot), content: inSlot.notes ?? '' } : undefined,
    });
    router.push('/post');
  };

  return (
    <RetroGamingPCButton variant="create"
      label={review ? (review.status === 'published' ? 'Edit your review' : 'Resume review draft') : 'Write a review'}
      loading={myReview.isPending}
      onPress={open}
    />
  );
}
