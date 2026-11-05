/**
 * Replays (migration 000040): finish dates, the review form's replay fields,
 * which review the Studio opens, replay chart bars and the Gamer Profile line.
 */
import type { StudioTarget } from '@/hooks/useStudioStore';
import type { Review } from '@/types/database.types';
import { finishedOnSchema, localToday, reviewFormSchema } from '@/utils/reviewSchemas';
import { gamerProfileSummary, replayYearBars } from '@/utils/stats';
import { resolveStudioTarget, summarizeMyReviews } from '@/utils/studioTarget';

const review = (id: string, status: 'draft' | 'published', created: string, isReplay = false): Review => ({
  id,
  user_id: 'me',
  game_id: 1,
  rating: 80,
  rating_input_scale: 'numeric',
  rating_input: '80',
  legacy_rating_10: null,
  platform_id: null,
  content: null,
  status,
  created_at: created,
  updated_at: created,
  published_at: status === 'published' ? created : null,
  is_replay: isReplay,
  finished_on: isReplay ? created.slice(0, 10) : null,
});
const target = (extra: Partial<StudioTarget> = {}): StudioTarget => ({ gameId: 1, nonce: 1, ...extra });

describe('finish dates', () => {
  it('formats today in the device time zone', () => {
    expect(localToday(new Date(2024, 0, 5))).toBe('2024-01-05');
  });
  it('accepts real past days, rejects future, impossible and pre-1970 dates', () => {
    expect(finishedOnSchema.safeParse('2019-05-01').success).toBe(true);
    expect(finishedOnSchema.safeParse(localToday()).success).toBe(true);
    expect(finishedOnSchema.safeParse('2999-01-01').success).toBe(false);
    expect(finishedOnSchema.safeParse('2023-02-30').success).toBe(false);
    expect(finishedOnSchema.safeParse('1969-12-31').success).toBe(false);
    expect(finishedOnSchema.safeParse('5/1/2019').success).toBe(false);
  });
  it('review form: replay fields default off, and a replay needs a valid date', () => {
    const base = { gameId: 1, rating: null, content: 'notes', status: 'draft' as const, platformId: null };
    const plain = reviewFormSchema.parse(base);
    expect([plain.isReplay, plain.finishedOn]).toEqual([false, null]);
    expect(reviewFormSchema.safeParse({ ...base, isReplay: true, finishedOn: '2999-01-01' }).success).toBe(false);
    expect(reviewFormSchema.safeParse({ ...base, isReplay: true, finishedOn: '2020-01-01' }).success).toBe(true);
  });
});

describe('which review the Studio opens', () => {
  const first = review('a', 'published', '2024-01-01T00:00:00Z');
  const second = review('b', 'published', '2025-01-01T00:00:00Z', true);
  const draft = review('c', 'draft', '2026-01-01T00:00:00Z', true);

  it('a game you never reviewed: a new first review', () => {
    expect(resolveStudioTarget(target(), summarizeMyReviews([]))).toEqual({ kind: 'new', prior: 0 });
  });
  it('resumes your draft first', () => {
    const r = resolveStudioTarget(target(), summarizeMyReviews([first, draft]));
    expect(r).toEqual({ kind: 'edit', review: draft, prior: 1 });
  });
  it('after publishing, asks: edit the newest review or write a replay review', () => {
    expect(resolveStudioTarget(target(), summarizeMyReviews([first, second]))).toEqual({ kind: 'choose', latest: second, count: 2 });
  });
  it('opens the review asked for (review page, Drafts), counting the reviews before it', () => {
    expect(resolveStudioTarget(target({ reviewId: 'a' }), summarizeMyReviews([first, second]))).toEqual({ kind: 'edit', review: first, prior: 0 });
    expect(resolveStudioTarget(target({ reviewId: 'b' }), summarizeMyReviews([first, second]))).toEqual({ kind: 'edit', review: second, prior: 1 });
  });
  it('a new replay review counts every earlier review', () => {
    expect(resolveStudioTarget(target({ newReview: true }), summarizeMyReviews([first, second]))).toEqual({ kind: 'new', prior: 2 });
  });
  it('a just-saved review not loaded yet stays a new one (no flicker back to the choice)', () => {
    expect(resolveStudioTarget(target({ reviewId: 'z' }), summarizeMyReviews([first]))).toEqual({ kind: 'new', prior: 1 });
  });
});

describe('replay stats', () => {
  it('bars per year, oldest first', () => {
    expect(replayYearBars([{ year: 2024, replays: 1 }, { year: 2021, replays: 3 }]).map((b) => [b.label, b.value, b.detail])).toEqual([
      ['2021', 3, '3 replays'],
      ['2024', 1, '1 replay'],
    ]);
  });
  it('Gamer Profile mentions your most replayed game', () => {
    const empty = { histogram: [], platforms: [], genres: [], genreAverages: [], decades: [], studios: [] };
    expect(gamerProfileSummary({ ...empty, mostReplayed: { name: 'Hollow Depths', plays: 4 } })).toEqual([
      'You keep coming back to Hollow Depths (4 plays).',
    ]);
    expect(gamerProfileSummary({ ...empty, mostReplayed: null })).toEqual([]);
  });
});
