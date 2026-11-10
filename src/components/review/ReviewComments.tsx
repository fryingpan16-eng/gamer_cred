import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { MembersOnly } from '@/components/auth/MembersOnly';
import { MoreMenu } from '@/components/safety/MoreMenu';
import { Thumbnail } from '@/components/search/Thumbnail';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCInput,
  RetroGamingPCPanel,
  RetroGamingPCSpinner,
  RetroGamingPCTimeAgo,
} from '@/components/ui';
import { UserName, useShownName } from '@/components/user/UserName';
import { LIKE_COLOR } from '@/constants/likeColor';
import { useIsGuest } from '@/hooks/useAuth';
import { useEditComment, usePostComment, useReviewComments, useToggleCommentLike } from '@/hooks/useComments';
import type { ReviewComment } from '@/services/comments';
import { TOUCH_SLOP } from '@/utils/platform';
import { COMMENT_MAX_LENGTH } from '@/utils/reviewSchemas';

/** ♥ on someone else's comment; on your own, the private count. */
function CommentLike({ comment, isMine }: { comment: ReviewComment; isMine: boolean }) {
  const isGuest = useIsGuest();
  const toggle = useToggleCommentLike(comment.reviewId);
  if (isMine) {
    const n = comment.likeCount ?? 0;
    return n > 0 ? (
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        <Text style={{ color: LIKE_COLOR }}>♥ {n}</Text> · only you see this
      </Text>
    ) : null;
  }
  if (isGuest) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={comment.liked ? 'Unlike this comment' : 'Like this comment'}
      accessibilityState={{ selected: comment.liked }}
      hitSlop={TOUCH_SLOP}
      onPress={() => toggle.mutate({ commentId: comment.id, liked: !comment.liked })}
      className="min-h-[28px] flex-row items-center gap-1"
    >
      <MaterialCommunityIcons name={comment.liked ? 'heart' : 'heart-outline'} size={13} color={LIKE_COLOR} />
      <Text className="text-retrogamingpc-xs font-bold" style={{ color: LIKE_COLOR }}>
        {comment.liked ? 'Liked' : 'Like'}
      </Text>
    </Pressable>
  );
}

function TextAction({ label, accessibilityLabel, onPress }: { label: string; accessibilityLabel: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} hitSlop={TOUCH_SLOP} onPress={onPress} className="min-h-[28px] justify-center">
      <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright underline">{label}</Text>
    </Pressable>
  );
}

function CommentRow({ comment, viewerId, onReply }: { comment: ReviewComment; viewerId: string | null; onReply: (handle: string) => void }) {
  const isMine = comment.userId === viewerId;
  const isGuest = useIsGuest();
  const name = useShownName(comment.author.id, comment.author.username).name;
  const edit = useEditComment(comment.reviewId);
  const [draft, setDraft] = useState<string | null>(null);
  const openAuthor = () => router.push(isMine ? '/profile' : { pathname: '/user/[id]', params: { id: comment.author.id } });

  const save = () => {
    if (draft === null) return;
    edit.mutate({ commentId: comment.id, content: draft }, { onSuccess: () => setDraft(null) });
  };

  return (
    <View className="flex-row gap-2 border-t border-t-retrogamingpc-bevel-dark pt-2" style={comment.pending ? { opacity: 0.5 } : undefined}>
      <Pressable accessibilityRole="link" accessibilityLabel={`Open ${name}'s profile`} onPress={openAuthor} hitSlop={4}>
        <Thumbnail uri={comment.author.avatar_url} fallback={comment.author.username} shape="square" accessibilityLabel="" />
      </Pressable>
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-1">
          <Text onPress={openAuthor} numberOfLines={1}>
            <UserName userId={comment.author.id} username={comment.author.username} className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright" />
          </Text>
          {isMine ? <RetroGamingPCBadge label="You" variant="nowPlaying" /> : null}
          {comment.pending ? (
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Posting…</Text>
          ) : (
            <RetroGamingPCTimeAgo iso={comment.createdAt} suffix={comment.editedAt ? ' · edited' : ''} />
          )}
        </View>

        {draft !== null ? (
          <View className="gap-2">
            <RetroGamingPCInput
              accessibilityLabel="Edit your comment"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={COMMENT_MAX_LENGTH}
              error={edit.error?.message}
              autoFocus
            />
            <View className="flex-row flex-wrap justify-end gap-2">
              <RetroGamingPCButton variant="cancel" label="Cancel" onPress={() => { setDraft(null); edit.reset(); }} />
              <RetroGamingPCButton variant="save" label="Save" loading={edit.isPending} onPress={save} />
            </View>
          </View>
        ) : (
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text" selectable>
            {comment.content}
          </Text>
        )}

        {draft === null && !comment.pending ? (
          <View className="flex-row flex-wrap items-center gap-3">
            <CommentLike comment={comment} isMine={isMine} />
            {!isGuest ? <TextAction label="Reply" accessibilityLabel={`Reply to ${name}`} onPress={() => onReply(comment.author.username)} /> : null}
            {isMine ? <TextAction label="Edit" accessibilityLabel="Edit your comment" onPress={() => setDraft(comment.content)} /> : null}
            {!isMine ? (
              <MoreMenu
                label={`${name}'s comment`}
                report={{ targetType: 'comment', targetId: comment.id, targetUserId: comment.userId, label: `${name}'s comment`, ownerName: name }}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The comment thread under a published review (migration 000043): oldest first,
 * "@name" replies, ♥ likes, edit your own, ⚑ report others. Guests read only.
 */
export function ReviewComments({ reviewId, viewerId }: { reviewId: string; viewerId: string | null }) {
  const comments = useReviewComments(reviewId);
  const post = usePostComment(reviewId);
  const isGuest = useIsGuest();
  const [text, setText] = useState('');
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const all = comments.data?.pages.flatMap((p) => p.comments) ?? [];

  const reply = (handle: string) => {
    const tag = `@${handle} `;
    setText((t) => (t.startsWith(tag) ? t : tag + t));
    inputRef.current?.focus();
  };
  // The box clears at once (the comment shows greyed while it posts); a failure puts the text back.
  const submit = () => {
    const sent = text;
    setText('');
    post.mutate(sent, { onError: () => setText((t) => (t === '' ? sent : t)) });
  };

  return (
    <RetroGamingPCPanel title={all.length > 0 ? `Comments (${all.length}${comments.hasNextPage ? '+' : ''})` : 'Comments'}>
      <View className="gap-2">
        {comments.isPending ? (
          <RetroGamingPCSpinner label="Loading comments…" />
        ) : comments.isError ? (
          <RetroGamingPCAlert message={comments.error.message} />
        ) : all.length === 0 ? (
          isGuest ? (
            <Text className="text-retrogamingpc-xs italic text-retrogamingpc-text-muted">No comments yet.</Text>
          ) : (
            <Pressable accessibilityRole="button" hitSlop={TOUCH_SLOP} onPress={() => inputRef.current?.focus()} className="min-h-[28px] justify-center self-start">
              <Text className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright underline">No comments yet. Be the first to comment ▸</Text>
            </Pressable>
          )
        ) : (
          all.map((c) => <CommentRow key={c.id} comment={c} viewerId={viewerId} onReply={reply} />)
        )}

        {comments.hasNextPage ? (
          <View className="flex-row justify-center">
            <RetroGamingPCButton label="Load more comments" loading={comments.isFetchingNextPage} onPress={() => void comments.fetchNextPage()} />
          </View>
        ) : null}

        <MembersOnly feature="comment on reviews">
          <View className="gap-2 border-t border-t-retrogamingpc-bevel-dark pt-2">
            <RetroGamingPCInput
              ref={inputRef}
              label="Add a comment"
              value={text}
              onChangeText={(t) => {
                setText(t);
                if (post.error) post.reset();
              }}
              multiline
              maxLength={COMMENT_MAX_LENGTH}
              placeholder="Say something about this review"
              error={post.error?.message}
              hint={text.length > COMMENT_MAX_LENGTH - 200 ? `${text.length.toLocaleString()} / ${COMMENT_MAX_LENGTH.toLocaleString()}` : undefined}
            />
            <View className="flex-row justify-end">
              <RetroGamingPCButton variant="save" label="Post comment" loading={post.isPending} disabled={text.trim().length === 0} onPress={submit} />
            </View>
          </View>
        </MembersOnly>
      </View>
    </RetroGamingPCPanel>
  );
}
