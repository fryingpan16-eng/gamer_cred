import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { ACTION_COLORS } from '@/constants/actionColors';
import { TOUCH_SLOP } from '@/utils/platform';

import { ReportModal, type ReportSubject } from './ReportModal';

/** Small "⚑ Report" text button that opens the report dialog. */
export function ReportLink({ subject, label = 'Report' }: { subject: ReportSubject; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Report ${subject.label}`} hitSlop={TOUCH_SLOP} onPress={() => setOpen(true)} className="min-h-[28px] justify-center">
        <Text className="text-retrogamingpc-xs font-bold underline" style={{ color: ACTION_COLORS.cancel.text }}>
          ⚑ {label}
        </Text>
      </Pressable>
      <ReportModal subject={open ? subject : null} onClose={() => setOpen(false)} />
    </>
  );
}
