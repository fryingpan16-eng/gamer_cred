import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';

import { REPORT_REASONS } from '@/components/safety/ReportModal';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCCard,
  RetroGamingPCConfirmModal,
  RetroGamingPCSpinner,
  RetroGamingPCTabs,
  type RetroGamingPCTabItem,
} from '@/components/ui';
import { REPORT_RESPONSE_HOURS } from '@/constants/legal';
import { useIsAdmin } from '@/hooks/useLists';
import { useAdminReports, useModerate, type ModerationAction } from '@/hooks/useSafety';
import type { AdminReport } from '@/services/safety';

type Status = 'open' | 'actioned' | 'dismissed';
const TABS: readonly RetroGamingPCTabItem<Status>[] = [
  { key: 'open', label: 'Open' },
  { key: 'actioned', label: 'Actioned' },
  { key: 'dismissed', label: 'Dismissed' },
];

const REASON_LABEL = Object.fromEntries(REPORT_REASONS.map((r) => [r.key, r.label]));
const TYPE_LABEL = { review: 'Review', list: 'List', rating: 'Rating', user: 'Player' } as const;

const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
        {report.open_reports_on_target > 1 ? <RetroGamingPCBadge label={`${report.open_reports_on_target} reports`} variant="main" /> : null}
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
            <RetroGamingPCButton variant="danger" label={`Remove ${TYPE_LABEL[report.target_type].toLowerCase()}`} onPress={() => onAction({ ...target, action: 'remove' })} />
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
  remove: { title: 'Remove content', message: 'Delete this content for everyone and close its reports? This can’t be undone.', label: 'Remove' },
  removeUser: {
    title: 'Remove account',
    message: 'Permanently delete this player’s account and everything they posted, and close every report about them? This can’t be undone.',
    label: 'Remove account',
  },
};

/** Admin moderation queue: reports on reviews, lists, ratings and players, oldest first. */
export default function ModerationScreen() {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<Status>('open');
  const reports = useAdminReports(status);
  const moderate = useModerate();
  const [pending, setPending] = useState<ModerationAction | null>(null);

  if (isAdmin.isPending) return <RetroGamingPCSpinner label="Checking access…" />;
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
        <RetroGamingPCTabs items={TABS} value={status} onChange={setStatus} fill />
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Aim to act on every report within {REPORT_RESPONSE_HOURS} hours (store requirement).</Text>
      </View>
      {reports.isPending ? (
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
          ListEmptyComponent={<RetroGamingPCAlert tone="success" message={status === 'open' ? 'No open reports. All clear.' : 'Nothing here yet.'} />}
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
