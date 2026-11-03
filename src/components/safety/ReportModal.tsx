import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCheckbox, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { REPORT_RESPONSE_HOURS, SUPPORT_EMAIL } from '@/constants/legal';
import { useBlockUser, useSubmitReport } from '@/hooks/useSafety';
import { showToast } from '@/hooks/useToastStore';
import type { ReportInput } from '@/services/safety';
import type { ReportReason } from '@/types/database.types';
import { cn } from '@/utils/cn';

export const REPORT_REASONS: readonly { key: ReportReason; label: string }[] = [
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'hate', label: 'Hate speech or slurs' },
  { key: 'sexual', label: 'Sexual content' },
  { key: 'violence', label: 'Violence or threats' },
  { key: 'self_harm', label: 'Self-harm' },
  { key: 'spam', label: 'Spam or scam' },
  { key: 'impersonation', label: 'Impersonation' },
  { key: 'spoilers', label: 'Unmarked spoilers' },
  { key: 'other', label: 'Something else' },
];

export type ReportSubject = Omit<ReportInput, 'reason' | 'details'> & {
  /** "this review", "this list", "sam" … */
  label: string;
  /** Username of the content's owner, for the "also block" option. */
  ownerName: string | null;
};

function Body({ subject, onClose }: { subject: ReportSubject; onClose: () => void }) {
  const report = useSubmitReport();
  const block = useBlockUser();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);

  const send = () => {
    if (!reason) return;
    report.mutate(
      { targetType: subject.targetType, targetId: subject.targetId, targetUserId: subject.targetUserId, reason, details },
      {
        onSuccess: () => {
          if (alsoBlock) block.mutate({ userId: subject.targetUserId, block: true });
          showToast(`Thanks — the GamerCred team reviews reports within ${REPORT_RESPONSE_HOURS} hours.`, 'success');
          onClose();
        },
      },
    );
  };

  return (
    <View className="gap-3">
      {report.isError ? <RetroGamingPCAlert message={report.error.message} /> : null}
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text">What’s wrong with {subject.label}?</Text>
      <View className="gap-1" accessibilityRole="radiogroup">
        {REPORT_REASONS.map((r) => {
          const selected = reason === r.key;
          return (
            <Pressable
              key={r.key}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(r.key)}
              className={cn('min-h-[36px] flex-row items-center gap-2 border px-2', selected ? 'border-2 border-retrogamingpc-text-bright bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button')}
            >
              <View className="retrogamingpc-bevel-inset h-4 w-4 items-center justify-center bg-retrogamingpc-dark">
                {selected ? <View className="h-2 w-2 bg-retrogamingpc-text-bright" /> : null}
              </View>
              <Text className={cn('text-retrogamingpc-sm', selected ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text')}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <RetroGamingPCInput label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} placeholder="Anything that helps us review it" />
      {subject.ownerName ? (
        <RetroGamingPCCheckbox
          checked={alsoBlock}
          onToggle={() => setAlsoBlock((v) => !v)}
          label={`Also block ${subject.ownerName}`}
          description="You won’t see each other on GamerCred. You can unblock in Settings."
        />
      ) : null}
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
        Reports are private. The team reviews them within {REPORT_RESPONSE_HOURS} hours and removes anything that breaks the Community Guidelines. Urgent? Email {SUPPORT_EMAIL}.
      </Text>
      <View className="flex-row justify-end gap-2">
        <RetroGamingPCButton variant="cancel" label="Cancel" onPress={onClose} disabled={report.isPending} />
        <RetroGamingPCButton variant="save" label="Send Report" disabled={!reason} loading={report.isPending} onPress={send} />
      </View>
    </View>
  );
}

/** Report a review, list, rating or player (store requirement for user content). */
export function ReportModal({ subject, onClose }: { subject: ReportSubject | null; onClose: () => void }) {
  return (
    <RetroGamingPCModal visible={subject !== null} title="Report" onClose={onClose}>
      {subject ? <Body subject={subject} onClose={onClose} /> : null}
    </RetroGamingPCModal>
  );
}
