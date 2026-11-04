import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';

import { ListEditorModal } from '@/components/lists/ListEditorModal';
import { ReportLink } from '@/components/safety/ReportLink';
import { Thumbnail } from '@/components/search/Thumbnail';
import { gameMetaLine } from '@/components/search/GameResultCard';
import { GamePickerModal } from '@/components/studio/GamePickerModal';
import { UserName, useShownName } from '@/components/user/UserName';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCConfirmModal,
  RetroGamingPCPanel,
  RetroGamingPCSpinner,
  RetroGamingPCTierBadge,
} from '@/components/ui';
import { ACTION_COLORS } from '@/constants/actionColors';
import { useAuthStore } from '@/hooks/useAuth';
import { useGameLookup } from '@/hooks/useGames';
import {
  useDeleteList,
  useIsAdmin,
  useList,
  useListItems,
  usePinnedLists,
  useSetListPin,
  useSmartListGames,
  useUpdateList,
} from '@/hooks/useLists';
import { showToast } from '@/hooks/useToastStore';
import type { ListDetail } from '@/services/lists';
import { igdbImageUrl, type IgdbGameResult } from '@/types/igdb';
import { cn } from '@/utils/cn';
import { LIKE_COLOR } from '@/constants/likeColor';
import { LIST_MAX_GAMES } from '@/utils/listSchemas';
import { numericToTier } from '@/utils/rating';
import { describeRequirements, describeSmartRule, type SmartListGame } from '@/utils/smartLists';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function StepButton({
  label,
  a11y,
  onPress,
  disabled,
  tone,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      className={cn('retrogamingpc-bevel h-8 w-8 items-center justify-center bg-retrogamingpc-button', disabled && 'opacity-30')}
    >
      <Text
        className={cn('text-retrogamingpc-sm font-bold', !tone && 'text-retrogamingpc-text-bright')}
        style={tone ? { color: tone } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Admin: feature this list on Home at a position, or unfeature it. */
function AdminPinControls({ list }: { list: ListDetail }) {
  const pinned = usePinnedLists();
  const pin = useSetListPin();
  const count = (pinned.data ?? []).filter((l) => l.id !== list.id).length;
  const positions = Array.from({ length: Math.min(50, count + 1) }, (_, i) => i + 1);

  if (!list.isPublic) {
    return <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Make the list public to feature it on Home.</Text>;
  }
  return (
    <View className="gap-1.5">
      <Text className="retrogamingpc-label">Admin · Featured on Home</Text>
      <View className="flex-row flex-wrap items-center gap-1">
        {positions.map((rank) => {
          const selected = list.pinnedRank === rank;
          return (
            <Pressable
              key={rank}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Feature at position ${rank}`}
              disabled={pin.isPending}
              onPress={() => pin.mutate({ listId: list.id, rank })}
              className={cn(
                'min-h-[28px] min-w-[32px] items-center justify-center border px-2',
                selected
                  ? 'border-2 border-retrogamingpc-text-bright bg-retrogamingpc-active'
                  : 'border-retrogamingpc-accent bg-retrogamingpc-button',
              )}
            >
              <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">#{rank}</Text>
            </Pressable>
          );
        })}
        {list.pinnedRank !== null ? (
          <RetroGamingPCButton
            variant="cancel"
            label="Unfeature"
            loading={pin.isPending}
            onPress={() => pin.mutate({ listId: list.id, rank: null })}
          />
        ) : null}
      </View>
    </View>
  );
}

function GameRow({
  game,
  gameId,
  index,
  total,
  ranked,
  editable,
  score,
  onMove,
  onRemove,
}: {
  game: IgdbGameResult | undefined;
  gameId: number;
  index: number;
  total: number;
  ranked: boolean;
  editable: boolean;
  /** Smart lists: the Gamer Cred average and rating count behind the rank. */
  score?: SmartListGame;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const name = game?.name ?? `Game #${gameId}`;
  const meta = game ? gameMetaLine(game) : '';
  return (
    <View className="retrogamingpc-bevel flex-row items-center gap-2 bg-retrogamingpc-card p-1.5">
      {ranked ? (
        <Text className="w-9 text-center font-mono text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright">#{index + 1}</Text>
      ) : null}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${ranked ? `#${index + 1} ` : ''}${name}. Open game page`}
        onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(gameId) } })}
        className="flex-1 flex-row items-center gap-2"
      >
        <Thumbnail
          uri={game?.coverImageId ? igdbImageUrl(game.coverImageId, 'cover_small', true) : null}
          fallback={name}
          shape="cover"
          accessibilityLabel=""
        />
        <View className="flex-1 gap-0.5">
          <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={2}>
            {name}
          </Text>
          {meta ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{meta}</Text> : null}
          {game && game.platforms.length > 0 ? (
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={1}>
              {game.platforms.join(' · ')}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {score ? (
        <View
          className="items-end gap-0.5"
          accessibilityLabel={[
            score.likeCount !== undefined ? `${score.likeCount} likes` : null,
            score.average !== null ? `Gamer Cred average ${score.average}` : null,
            `${score.ratingCount} ratings`,
          ]
            .filter(Boolean)
            .join(', ')}
        >
          {score.likeCount !== undefined ? (
            <Text className="font-mono text-retrogamingpc-base font-bold" style={{ color: LIKE_COLOR }}>
              ♥ {score.likeCount}
            </Text>
          ) : null}
          {score.average !== null ? (
            <View className="flex-row items-center gap-1">
              <Text
                className={cn(
                  'font-mono font-bold text-retrogamingpc-text-bright',
                  score.likeCount !== undefined ? 'text-retrogamingpc-xs' : 'text-retrogamingpc-base',
                )}
              >
                {score.average.toFixed(1)}
              </Text>
              <RetroGamingPCTierBadge tier={numericToTier(Math.round(score.average))} showDescriptor={false} size="compact" />
            </View>
          ) : null}
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            {score.ratingCount} rating{score.ratingCount === 1 ? '' : 's'}
          </Text>
        </View>
      ) : null}
      {editable ? (
        <View className="flex-row gap-1">
          <StepButton label="▲" a11y={`Move ${name} up`} disabled={index === 0} onPress={() => onMove(index)} />
          <StepButton label="▼" a11y={`Move ${name} down`} disabled={index === total - 1} onPress={() => onMove(index + 2)} />
          <StepButton label="✕" a11y={`Remove ${name} from the list`} tone={ACTION_COLORS.cancel.text} onPress={onRemove} />
        </View>
      ) : null}
    </View>
  );
}

/** A game list: header, owner tools (edit, add games, reorder, delete) and admin featuring. */
export default function ListScreen() {
  // ?add=1: just created from "New List" — open the game picker straight away.
  const { id, add } = useLocalSearchParams<{ id: string; add?: string }>();
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const list = useList(id ?? null);
  const data = list.data ?? null;
  const ownerName = useShownName(data?.owner?.id, data?.owner?.username ?? '').name;
  const smartRule = data?.smartRule ?? null;
  const smart = useSmartListGames(id ?? null, smartRule !== null);
  const smartGames = smart.data?.games ?? [];
  const gameIds = smartRule ? smartGames.map((g) => g.gameId) : (data?.gameIds ?? []);
  const scoreById = new Map(smartGames.map((g) => [g.gameId, g] as const));
  const games = useGameLookup(gameIds);
  const items = useListItems(id ?? 'none');
  const update = useUpdateList(id ?? 'none');
  const remove = useDeleteList();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(add === '1');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (list.isPending) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <RetroGamingPCSpinner label="Loading list…" />
      </View>
    );
  }
  if (list.isError || !data) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'List' }} />
        <RetroGamingPCPanel title="List not found">
          <RetroGamingPCAlert message={list.isError ? list.error.message : 'This list was deleted, or it is private.'} />
        </RetroGamingPCPanel>
      </View>
    );
  }

  const isOwner = viewerId === data.userId;
  const onList = new Map(data.gameIds.map((g) => [g, 'On this list'] as const));
  const full = data.gameIds.length >= LIST_MAX_GAMES;

  const header = (
    <View className="gap-3 pb-3">
      <RetroGamingPCPanel title={data.isRanked ? 'Ranked List' : 'List'}>
        <View className="gap-2">
          <Text role="heading" className="text-retrogamingpc-xl font-bold text-retrogamingpc-text-bright">
            {data.title}
          </Text>
          <View className="flex-row flex-wrap items-center gap-1">
            {data.pinnedRank !== null ? <RetroGamingPCBadge label={`Featured #${data.pinnedRank}`} variant="main" /> : null}
            {smartRule ? <RetroGamingPCBadge label="Auto-updated" variant="published" /> : null}
            {data.isRanked && !smartRule ? <RetroGamingPCBadge label="Ranked" variant="nowPlaying" /> : null}
            {!data.isPublic ? <RetroGamingPCBadge label="Private — only you" variant="neutral" /> : null}
          </View>
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            {data.owner ? (
              <Text
                accessibilityRole="link"
                onPress={() => router.push({ pathname: '/user/[id]', params: { id: data.owner!.id } })}
              >
                <UserName userId={data.owner.id} username={data.owner.username} className="font-bold text-retrogamingpc-text-bright underline" />
              </Text>
            ) : (
              'Unknown player'
            )}
            {smartRule
              ? ` · ${smart.data ? `${gameIds.length} game${gameIds.length === 1 ? '' : 's'}` : 'loading'} · updated daily${
                  smart.data?.computedAt ? `, last on ${fmtDate(smart.data.computedAt)}` : ''
                }`
              : ` · ${gameIds.length} game${gameIds.length === 1 ? '' : 's'} · updated ${fmtDate(data.updatedAt)}`}
          </Text>
          {data.description ? (
            <Text className="text-retrogamingpc-sm leading-[18px] text-retrogamingpc-text">{data.description}</Text>
          ) : null}
          {smartRule ? (
            <View className="retrogamingpc-bevel-inset gap-0.5 bg-retrogamingpc-dark p-2">
              <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text">{describeSmartRule(smartRule)}</Text>
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
                {smartRule.rankBy === 'likes'
                  ? 'Ranked by how many players like each game. Recalculated once a day.'
                  : `Ranked by Gamer Cred average. ${smart.data ? describeRequirements(smart.data.requirements) : ''} Recalculated once a day, so the bar rises as more players rate games.`}
              </Text>
            </View>
          ) : null}
          {smart.isError ? <RetroGamingPCAlert message={smart.error.message} /> : null}
          {isOwner ? (
            <View className="flex-row flex-wrap gap-2 pt-1">
              {smartRule ? null : (
                <RetroGamingPCButton variant="create" label="Add Games" disabled={full} onPress={() => setAdding(true)} />
              )}
              <RetroGamingPCButton label="Edit Details" onPress={() => setEditing(true)} />
              <RetroGamingPCButton variant="danger" label="Delete List" onPress={() => setConfirmDelete(true)} />
            </View>
          ) : null}
          {!isOwner && data.owner ? (
            <View className="flex-row">
              <ReportLink
                label="Report list"
                subject={{
                  targetType: 'list',
                  targetId: data.id,
                  targetUserId: data.userId,
                  label: 'this list',
                  ownerName: ownerName,
                }}
              />
            </View>
          ) : null}
          {full && isOwner ? (
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Lists hold up to {LIST_MAX_GAMES} games.</Text>
          ) : null}
          {isAdmin.data ? <AdminPinControls list={data} /> : null}
        </View>
      </RetroGamingPCPanel>
    </View>
  );

  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title: data.title }} />
      <FlatList
        data={gameIds}
        keyExtractor={(g) => String(g)}
        contentContainerClassName="gap-1.5 p-3 md:max-w-[860px] md:w-full md:self-center"
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <GameRow
            gameId={item}
            game={games.data?.get(item)}
            index={index}
            total={gameIds.length}
            ranked={data.isRanked}
            editable={isOwner && !smartRule}
            score={scoreById.get(item)}
            onMove={(to) => items.mutate({ action: 'move', gameId: item, to })}
            onRemove={() => items.mutate({ action: 'remove', gameId: item })}
          />
        )}
        ListEmptyComponent={
          <View className="retrogamingpc-bevel-inset items-center gap-2 bg-retrogamingpc-dark px-4 py-6">
            {smartRule && smart.isPending ? (
              <RetroGamingPCSpinner label="Working out the list…" />
            ) : smartRule ? (
              <>
                <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text">No games qualify yet</Text>
                <Text className="text-center text-retrogamingpc-xs text-retrogamingpc-text-muted">
                  Games appear here once enough players have rated them.
                </Text>
              </>
            ) : (
              <>
                <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text">No games yet</Text>
                {isOwner ? <RetroGamingPCButton variant="create" label="Add Games" onPress={() => setAdding(true)} /> : null}
              </>
            )}
          </View>
        }
      />

      {isOwner ? (
        <>
          <GamePickerModal
            visible={adding}
            title={`Add to “${data.title}”`}
            closeLabel="Done"
            unavailable={onList}
            onClose={() => setAdding(false)}
            onPick={(game) => {
              items.mutate({ action: 'add', gameId: game.id });
              showToast(`Added ${game.name}`, 'success');
            }}
          />
          <ListEditorModal
            visible={editing}
            initial={{
              title: data.title,
              description: data.description ?? '',
              isRanked: data.isRanked,
              isPublic: data.isPublic,
              smartRule,
            }}
            allowSmart={isAdmin.data === true}
            pinned={data.pinnedRank !== null}
            saving={update.isPending}
            error={update.isError ? update.error.message : null}
            onClose={() => setEditing(false)}
            onSave={(values) => update.mutate(values, { onSuccess: () => setEditing(false) })}
          />
          <RetroGamingPCConfirmModal
            visible={confirmDelete}
            title="Delete list"
            message={
              smartRule
                ? `Delete the smart list “${data.title}”? This can't be undone.`
                : `Delete “${data.title}” and its ${gameIds.length} game${gameIds.length === 1 ? '' : 's'}? This can't be undone.`
            }
            confirmLabel="Delete"
            destructive
            busy={remove.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() =>
              remove.mutate(data.id, {
                onSuccess: () => {
                  setConfirmDelete(false);
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                },
                onError: (e) => {
                  setConfirmDelete(false);
                  showToast(e.message, 'error');
                },
              })
            }
          />
        </>
      ) : null}
    </View>
  );
}
