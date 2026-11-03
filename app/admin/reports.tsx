import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Image, Text, View } from 'react-native';

import { REPORT_REASONS } from '@/components/safety/ReportModal';
import { AdminSecurityBody } from '@/components/settings/AdminSecuritySetting';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCCard,
  RetroGamingPCConfirmModal,
  RetroGamingPCPanel,
  RetroGamingPCSpinner,
  RetroGamingPCTabs,
  type RetroGamingPCTabItem,
} from '@/components/ui';
import { REPORT_RESPONSE_HOURS } from '@/constants/legal';
import { useAdminActivity, useAdminStatus } from '@/hooks/useAdminSecurity';
import { useIsAdmin } from '@/hooks/useLists';
import { useAdminReports, useDecideHeldAvatar, useHeldAvatars, useModerate, type ModerationAction } from '@/hooks/useSafety';
import type { HeldPicture } from '@/services/avatar';
import type { AdminReport } from '@/services/safety';
import { describeAdminAction, type AdminActivityEntry } from '@/utils/adminSecurity';

type Status = 'open' | 'actioned' | 'dismissed';
/** Report statuses, profile pictures held by the automatic check, and the admin activity log. */
type Tab = Status | 'pictures' | 'activity';

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function ActivityRow({ entry }: { entry: AdminActivityEntry }) {
  const listId = entry.targetType === 'list' && entry.action.startsWith('list.') ? entry.targetId : null;
  return (
    <RetroGamingPCCard className="gap-0.5">
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text-bright">{describeAdminAction(entry)}</Text>
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        {entry.adminName ?? 'Removed admin'} · {fmtWhen(entry.createdAt)}
        {typeof entry.details.note === 'string' && entry.details.note ? ` · “${entry.details.note}”` : ''}
      </Text>
      {listId ? (
        <Text
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/list/[id]', params: { id: listId } })}
          className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline"
        >
          Open list
        </Text>
      ) : null}
    </RetroGamingPCCard>
  );
}

/** Every admin action, newest first. Entries can't be edited or deleted. */
function ActivityLog() {
  const activity = useAdminActivity(true);
  if (activity.isPending) return <RetroGamingPCSpinner label="Loading activity…" className="p-3" />;
  if (activity.isError)
    return (
      <View className="p-3">
        <RetroGamingPCAlert message={activity.error.message} />
      </View>
    );
  return (
    <FlatList
      data={activity.data}
      keyExtractor={(a) => String(a.id)}
      contentContainerClassName="gap-2 p-3 md:max-w-[860px] md:w-full md:self-center"
      renderItem={({ item }) => <ActivityRow entry={item} />}
      ListEmptyComponent={<RetroGamingPCAlert tone="info" message="No admin actions yet." />}
    />
  );
}

const HELD_REASON: Record<string, string> = {
  possible_adult: 'Possible nudity',
  possibly_racy: 'Possibly suggestive',
  possible_violence: 'Possibly violent',
  check_unavailable: 'Automatic check unavailable',
};

/** A held profile picture: approve publishes it, reject discards it (the player keeps their old picture). */
function HeldPictureCard({ picture, busy, onDecide }: { picture: HeldPicture; busy: boolean; onDecide: (approve: boolean) => void }) {
  return (
    <RetroGamingPCCard className="flex-row flex-wrap gap-3">
      <View className="retrogamingpc-bevel-inset h-32 w-32 items-center justify-center overflow-hidden bg-retrogamingpc-dark">
        {picture.imageUrl ? (
          <Image
            source={{ uri: picture.imageUrl }}
            className="h-full w-full"
            resizeMode="cover"
            accessibilityLabel={`Held picture from ${picture.username ?? 'a player'}`}
          />
        ) : (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">No preview</Text>
        )}
      </View>
      <View className="min-w-[180px] flex-1 gap-1">
        <View className="flex-row flex-wrap gap-1">
          <RetroGamingPCBadge label={HELD_REASON[picture.reason] ?? picture.reason} variant="nowPlaying" />
          {hoursSince(picture.createdAt) > REPORT_RESPONSE_HOURS ? (
            <RetroGamingPCBadge label={`Over ${REPORT_RESPONSE_HOURS}h`} variant="draft" />
          ) : null}
        </View>
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          {fmt(picture.createdAt)} · <Text className="font-bold text-retrogamingpc-text-bright">{picture.username ?? 'deleted user'}</Text>
        </Text>
        {picture.scores ? (
          <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">
            adult {picture.scores.adult.toLowerCase()} · racy {picture.scores.racy.toLowerCase()} · violence{' '}
            {picture.scores.violence.toLowerCase()}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2 pt-1">
          <RetroGamingPCButton variant="save" label="Approve" disabled={busy} onPress={() => onDecide(true)} />
          <RetroGamingPCButton variant="danger" label="Reject" disabled={busy} onPress={() => onDecide(false)} />
        </View>
      </View>
    </RetroGamingPCCard>
  );
}

function HeldPictures() {
  const held = useHeldAvatars();
  const decide = useDecideHeldAvatar();
  if (held.isPending) return <RetroGamingPCSpinner label="Loading pictures…" className="p-3" />;
  if (held.isError) {
    return (
      <View className="p-3">
        <RetroGamingPCAlert message={held.error.message} />
      </View>
    );
  }
  return (
    <FlatList
      data={held.data}
      keyExtractor={(p) => p.userId}
      contentContainerClassName="gap-2 p-3 md:max-w-[860px] md:w-full md:self-center"
      ListHeaderComponent={decide.isError ? <RetroGamingPCAlert message={decide.error.message} /> : undefined}
      renderItem={({ item }) => (
        <HeldPictureCard
          picture={item}
          busy={decide.isPending && decide.variables?.userId === item.userId}
          onDecide={(approve) => decide.mutate({ userId: item.userId, approve })}
        />
      )}
      ListEmptyComponent={<RetroGamingPCAlert tone="success" message="No pictures waiting. All clear." />}
    />
  );
}

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));
const TYPE_LABEL = { review: 'Review', list: 'List', rating: 'Rating', user: 'Player' } as const;

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const hoursSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 3_600_000;

function openTarget(r: AdminReport) {
  if (r.target_type === 'review') router.push({ pathname: '/review/[id]', params: { id: r.target_id } });
  else if (r.target_type === 'list') router.push({ pathname: '/list/[id]', params: { id: r.target_id } });
  else if (r.target_type === 'rating') router.push({ pathname: '/game/[id]', params: { id: r.target_id } });
  else router.push({ pathname: '/user/[id]', params: { id: r.target_user_id } });
}

function ReportCard({ report, onAction }: { report: AdminReport; onAction: (a: ModerationAction) => void }) {
  const overdue = report.status === 'open' && hoursSince(report.created_at) > REPORT_RESPONSE_HOURS;
  const target = { type: report.target_type, id: report.target_id, userId: report.target_user_id };
  return (
    <RetroGamingPCCard className="gap-2">
      <View className="flex-row flex-wrap items-center gap-1">
        <RetroGamingPCBadge label={TYPE_LABEL[report.target_type]} variant="nowPlaying" />
        <RetroGamingPCBadge label={REASON_LABEL[report.reason] ?? report.reason} />
        {report.open_reports_on_target > 1 ? (
          <RetroGamingPCBadge label={`${report.open_reports_on_target} reports`} variant="main" />
        ) : null}
        {overdue ? <RetroGamingPCBadge label={`Over ${REPORT_RESPONSE_HOURS}h`} variant="draft" /> : null}
        {!report.content_exists ? <RetroGamingPCBadge label="Already gone" /> : null}
      </View>
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        {fmt(report.created_at)} · by {report.reporter_username ?? 'deleted user'} · about{' '}
        <Text className="font-bold text-retrogamingpc-text-bright">{report.target_username ?? 'deleted user'}</Text>
      </Text>
      {report.preview ? (
        <View className="retrogamingpc-bevel-inset bg-retrogamingpc-dark p-2">
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text" selectable>
            {report.preview}
          </Text>
        </View>
      ) : null}
      {report.details ? <Text className="text-retrogamingpc-sm text-retrogamingpc-text">“{report.details}”</Text> : null}
      {report.status === 'open' ? (
        <View className="flex-row flex-wrap gap-2">
          {report.content_exists ? <RetroGamingPCButton variant="navigate" label="View" onPress={() => openTarget(report)} /> : null}
          <RetroGamingPCButton label="Dismiss" onPress={() => onAction({ ...target, action: 'dismiss' })} />
          {report.target_type !== 'user' && report.content_exists ? (
            <RetroGamingPCButton
              variant="danger"
              label={`Remove ${TYPE_LABEL[report.target_type].toLowerCase()}`}
              onPress={() => onAction({ ...target, action: 'remove' })}
            />
          ) : null}
          {report.target_username ? (
            <RetroGamingPCButton variant="danger" label="Remove account" onPress={() => onAction({ ...target, action: 'removeUser' })} />
          ) : null}
        </View>
      ) : null}
    </RetroGamingPCCard>
  );
}

const CONFIRM: Record<ModerationAction['action'], { title: string; message: string; label: string }> = {
  dismiss: { title: 'Dismiss report', message: 'Close every open report on this item without changing anything?', label: 'Dismiss' },
  remove: {
    title: 'Remove content',
    message: 'Delete this content for everyone and close its reports? This can’t be undone.',
    label: 'Remove',
  },
  removeUser: {
    title: 'Remove account',
    message:
      'Permanently delete this player’s account and everything they posted, and close every report about them? This can’t be undone.',
    label: 'Remove account',
  },
};

/** Admin moderation queue: reports on reviews, lists, ratings and players, oldest first. */
export default function ModerationScreen() {
  const isAdmin = useIsAdmin();
  const adminStatus = useAdminStatus();
  const [tab, setTab] = useState<Tab>('open');
  const status: Status = tab === 'pictures' || tab === 'activity' ? 'open' : tab;
  const reports = useAdminReports(status);
  const held = useHeldAvatars(isAdmin.data === true);
  const tabs: RetroGamingPCTabItem<Tab>[] = [
    { key: 'open', label: 'Open' },
    { key: 'pictures', label: 'Pictures', count: held.data?.length || undefined },
    { key: 'actioned', label: 'Actioned' },
    { key: 'dismissed', label: 'Dismissed' },
    { key: 'activity', label: 'Activity' },
  ];
  const moderate = useModerate();
  const [pending, setPending] = useState<ModerationAction | null>(null);

  if (isAdmin.isPending || adminStatus.isPending) return <RetroGamingPCSpinner label="Checking access…" />;
  // Admins whose sign-in isn't code-verified yet get the unlock / setup box instead.
  if (!isAdmin.data && adminStatus.data?.member) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Moderation' }} />
        <RetroGamingPCPanel title="Unlock Admin Tools">
          <AdminSecurityBody compact />
        </RetroGamingPCPanel>
      </View>
    );
  }
  if (!isAdmin.data) {
    return (
      <View className="flex-1 bg-retrogamingpc-dark p-3">
        <Stack.Screen options={{ title: 'Moderation' }} />
        <RetroGamingPCAlert message="Only app admins can open the moderation queue." />
      </View>
    );
  }

  const confirm = pending ? CONFIRM[pending.action] : null;
  return (
    <View className="flex-1 bg-retrogamingpc-dark">
      <Stack.Screen options={{ title: 'Moderation' }} />
      <View className="gap-1 px-3 pt-3">
        <RetroGamingPCTabs items={tabs} value={tab} onChange={setTab} />
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          {tab === 'activity'
            ? 'Every admin action, newest first. Entries can’t be edited or deleted.'
            : tab === 'pictures'
              ? 'Profile pictures the automatic check wasn’t sure about. Nobody else sees them until you approve.'
              : `Aim to act on every report within ${REPORT_RESPONSE_HOURS} hours (store requirement).`}
        </Text>
      </View>
      {tab === 'activity' ? (
        <ActivityLog />
      ) : tab === 'pictures' ? (
        <HeldPictures />
      ) : reports.isPending ? (
        <RetroGamingPCSpinner label="Loading reports…" className="p-3" />
      ) : reports.isError ? (
        <View className="p-3">
          <RetroGamingPCAlert message={reports.error.message} />
        </View>
      ) : (
        <FlatList
          data={reports.data}
          keyExtractor={(r) => r.id}
          contentContainerClassName="gap-2 p-3 md:max-w-[860px] md:w-full md:self-center"
          renderItem={({ item }) => <ReportCard report={item} onAction={setPending} />}
          ListEmptyComponent={
            <RetroGamingPCAlert tone="success" message={status === 'open' ? 'No open reports. All clear.' : 'Nothing here yet.'} />
          }
        />
      )}
      <RetroGamingPCConfirmModal
        visible={pending !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label ?? 'OK'}
        destructive={pending?.action !== 'dismiss'}
        busy={moderate.isPending}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && moderate.mutate(pending, { onSettled: () => setPending(null) })}
      />
    </View>
  );
}
