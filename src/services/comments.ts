/**
 * Comments on reviews (migration 000043): a flat thread under each published
 * review, oldest first. Members post and edit their own; nobody deletes (admins
 * remove reported ones). Comment likes are private like review likes.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import { commentSchema } from '@/utils/reviewSchemas';

import { supabase } from './supabase';

function fail(error: PostgrestError, fallback: string): never {
  throw new Error(error.message || fallback);
}

export const COMMENTS_PAGE = 50;

export type ReviewComment = {
  id: string;
  reviewId: string;
  userId: string;
  author: { id: string; username: string; avatar_url: string | null };
  content: string;
  createdAt: string;
  /** Set when the writer changed the text. */
  editedAt: string | null;
  liked: boolean;
  /** Only on your own comments. */
  likeCount: number | null;
  /** Shown before the server confirms it (greyed, no actions). */
  pending?: boolean;
};

export async function fetchReviewComments(reviewId: string, page: number): Promise<{ comments: ReviewComment[]; nextPage: number | null }> {
  const { data, error } = await supabase.rpc('review_comments_page', {
    p_review_id: reviewId,
    p_offset: page * COMMENTS_PAGE,
    p_limit: COMMENTS_PAGE,
  });
  if (error) fail(error, 'Could not load comments.');
  return {
    comments: data.map((c) => ({
      id: c.id,
      reviewId: c.review_id,
      userId: c.user_id,
      author: { id: c.user_id, username: c.author_username, avatar_url: c.author_avatar_url },
      content: c.content,
      createdAt: c.created_at,
      editedAt: c.edited_at,
      liked: c.liked,
      likeCount: c.like_count,
    })),
    nextPage: data.length === COMMENTS_PAGE ? page + 1 : null,
  };
}

/** Throws the first validation message (empty, too long, or the content filter). */
function cleanComment(content: string): string {
  const parsed = commentSchema.safeParse(content);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your comment.');
  return parsed.data;
}

export async function postReviewComment(userId: string, reviewId: string, content: string): Promise<void> {
  const { error } = await supabase.from('review_comments').insert({ user_id: userId, review_id: reviewId, content: cleanComment(content) });
  if (error) fail(error, 'Could not post your comment.');
}

export async function editReviewComment(commentId: string, content: string): Promise<void> {
  const { error } = await supabase.from('review_comments').update({ content: cleanComment(content) }).eq('id', commentId);
  if (error) fail(error, 'Could not save your comment.');
}

export async function setCommentLike(userId: string, commentId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase
        .from('review_comment_likes')
        .upsert({ user_id: userId, comment_id: commentId }, { onConflict: 'user_id,comment_id', ignoreDuplicates: true })
    : await supabase.from('review_comment_likes').delete().eq('user_id', userId).eq('comment_id', commentId);
  if (error) fail(error, liked ? 'Could not like the comment.' : 'Could not remove the like.');
}
