import type { StudioTarget } from '@/hooks/useStudioStore';
import type { Review } from '@/types/database.types';

export type MyGameReviews = {
  /** Oldest first. */
  all: Review[];
  /** Your one draft of the game, if any (one per game, migration 000040). */
  draft: Review | null;
  /** Published reviews, oldest first. */
  published: Review[];
  /** Newest published review. */
  latestPublished: Review | null;
};

export function summarizeMyReviews(all: Review[]): MyGameReviews {
  const published = all.filter((r) => r.status === 'published');
  return {
    all,
    draft: all.find((r) => r.status === 'draft') ?? null,
    published,
    latestPublished: published[published.length - 1] ?? null,
  };
}

export type ResolvedStudioTarget =
  | { kind: 'edit'; review: Review; prior: number }
  | { kind: 'new'; prior: number }
  | { kind: 'choose'; latest: Review; count: number };

/**
 * What the Studio opens for a game (migration 000040: many reviews per game,
 * one draft): the review asked for, else your draft, else (after you've
 * published one) a choice between editing it and writing a replay review.
 */
export function resolveStudioTarget(target: StudioTarget, mine: MyGameReviews): ResolvedStudioTarget {
  const priorTo = (r: Review) => mine.all.filter((o) => o.id !== r.id && o.created_at < r.created_at).length;
  if (target.reviewId) {
    const review = mine.all.find((r) => r.id === target.reviewId);
    if (review) return { kind: 'edit', review, prior: priorTo(review) };
  }
  if (target.reviewId || target.newReview) return { kind: 'new', prior: mine.all.filter((r) => r.id !== target.reviewId).length };
  if (mine.draft) return { kind: 'edit', review: mine.draft, prior: priorTo(mine.draft) };
  if (mine.latestPublished) return { kind: 'choose', latest: mine.latestPublished, count: mine.published.length };
  return { kind: 'new', prior: 0 };
}
