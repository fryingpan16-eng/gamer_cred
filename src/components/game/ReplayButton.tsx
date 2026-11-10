import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { FinishedOnField } from '@/components/replays/FinishedOnField';
import { PlatformPicker } from '@/components/studio/PlatformPicker';
import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCModal, RetroGamingPCSpinner } from '@/components/ui';
import { platformInfo } from '@/constants/platforms';
import { useAddReplay, useDeleteReplay, useMyPlayCount, useMyReplays } from '@/hooks/useReplays';
import { useMyReviewsForGame } from '@/hooks/useReviews';
import { showToast } from '@/hooks/useToastStore';
import { TOUCH_SLOP } from '@/utils/platform';
import { finishedOnSchema, localToday } from '@/utils/reviewSchemas';

/** "2024-06-30" → "30 Jun 2024" in the device's locale (no time-zone shift). */
export function formatFinishedOn(day: string): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function playsLabel(plays: number): string {
  return plays > 1 ? `↻ Played ×${plays}` : '↻ Replayed';
}

type Row = { key: string; day: string; platformId: number | null; replayId: string | null; fromReview: boolean };

/**
 * Game page "Mark as Replayed" (migration 000040): a replay with a finish date
 * and platform, no score or text. The dialog also lists your replays (game-page
 * ones can be deleted; replay reviews are managed in the Review Studio).
 */
export function ReplayButton({
  gameId,
  gameName,
  hasRating,
  defaultPlatformId,
}: {
  gameId: number;
  gameName: string;
  hasRating: boolean;
  /** The platform you last played it on (your rating's / review's). */
  defaultPlatformId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const count = useMyPlayCount(gameId, hasRating);
  return (
    <>
      <RetroGamingPCButton
        variant="create"
        label={playsLabel(count.plays)}
        accessibilityLabel={count.plays > 1 ? `${gameName}: played ${count.plays} times. Open replays` : `Mark ${gameName} as replayed`}
        disabled={count.isPending}
        onPress={() => setOpen(true)}
      />
      {open ? <ReplayDialog gameId={gameId} gameName={gameName} hasRating={hasRating} defaultPlatformId={defaultPlatformId} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReplayDialog({
  gameId,
  gameName,
  hasRating,
  defaultPlatformId,
  onClose,
}: {
  gameId: number;
  gameName: string;
  hasRating: boolean;
  defaultPlatformId: number | null;
  onClose: () => void;
}) {
  const replays = useMyReplays(gameId);
  const reviews = useMyReviewsForGame(gameId);
  const count = useMyPlayCount(gameId, hasRating);
  const add = useAddReplay();
  const remove = useDeleteReplay();
  const lastPlatform = replays.data?.find((r) => r.platform_id !== null)?.platform_id ?? defaultPlatformId;
  const [day, setDay] = useState(localToday());
  const [platformChoice, setPlatformChoice] = useState<number | null | undefined>(undefined);
  const platformId = platformChoice === undefined ? lastPlatform : platformChoice;
  const [dayError, setDayError] = useState<string | undefined>(undefined);
  const [armed, setArmed] = useState<string | null>(null);

  const rows: Row[] = [
    ...(replays.data ?? []).map((r) => ({ key: r.id, day: r.finished_on, platformId: r.platform_id, replayId: r.id, fromReview: false })),
    ...(reviews.data?.published ?? [])
      .filter((r) => r.is_replay)
      .map((r) => ({
        key: r.id,
        day: r.finished_on ?? (r.published_at ?? r.created_at).slice(0, 10),
        platformId: r.platform_id,
        replayId: null,
        fromReview: true,
      })),
  ].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));

  const submit = () => {
    const parsed = finishedOnSchema.safeParse(day);
    if (!parsed.success) {
      setDayError(parsed.error.issues[0]?.message);
      return;
    }
    add.mutate(
      { gameId, finishedOn: parsed.data, platformId },
      {
        onSuccess: () => {
          showToast(`Marked ${gameName} as replayed.`, 'success');
          onClose();
        },
      },
    );
  };

  return (
    <RetroGamingPCModal
      visible
      title={`Replays · ${gameName}`}
      onClose={onClose}
      footer={
        <View className="flex-row flex-wrap justify-end gap-2">
          <RetroGamingPCButton variant="cancel" label="Close" onPress={onClose} disabled={add.isPending} />
          <RetroGamingPCButton variant="save" label="Mark as Replayed" loading={add.isPending} onPress={submit} />
        </View>
      }
    >
      <View className="gap-3">
        {add.isError ? <RetroGamingPCAlert message={add.error.message} /> : null}
        {remove.isError ? <RetroGamingPCAlert message={remove.error.message} /> : null}
        <Text className="text-retrogamingpc-sm leading-[19px] text-retrogamingpc-text">
          {count.plays > 1
            ? `You’ve played this ${count.plays} times (${count.replays} ${count.replays === 1 ? 'replay' : 'replays'}).`
            : 'Played it again? Log the replay here. It doesn’t change your score.'}{' '}
          To score a replay, write a new review in the Review Studio.
        </Text>

        <FinishedOnField
          value={day}
          onChange={(v) => {
            setDay(v);
            setDayError(undefined);
          }}
          error={dayError}
          disabled={add.isPending}
        />
        <PlatformPicker label="Played on" value={platformId} onChange={setPlatformChoice} />

        {replays.isPending || reviews.isPending ? (
          <RetroGamingPCSpinner label="Loading your replays…" />
        ) : rows.length > 0 ? (
          <View className="gap-1">
            <Text className="retrogamingpc-label">Your replays</Text>
            {rows.map((r) => (
              <View key={r.key} className="flex-row items-center gap-2 border-b border-b-retrogamingpc-accent py-1">
                <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text">
                  <Text className="font-mono text-retrogamingpc-text-bright">{formatFinishedOn(r.day)}</Text>
                  {r.platformId !== null ? ` · ${platformInfo(r.platformId).name}` : ''}
                  {r.fromReview ? <Text className="text-retrogamingpc-text-muted"> · review</Text> : null}
                </Text>
                {r.replayId ? (
                  armed === r.replayId ? (
                    <RetroGamingPCButton
                      variant="danger"
                      label="Delete"
                      loading={remove.isPending && remove.variables === r.replayId}
                      onPress={() => remove.mutate(r.replayId!, { onSettled: () => setArmed(null) })}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete the replay finished ${formatFinishedOn(r.day)}`}
                      hitSlop={TOUCH_SLOP}
                      onPress={() => setArmed(r.replayId)}
                      className="px-2"
                    >
                      <Text className="text-retrogamingpc-sm text-retrogamingpc-error">✕</Text>
                    </Pressable>
                  )
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </RetroGamingPCModal>
  );
}
