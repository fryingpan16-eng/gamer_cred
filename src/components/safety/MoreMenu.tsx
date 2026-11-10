import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { RetroGamingPCButton, RetroGamingPCModal } from '@/components/ui';
import { useIsGuest } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';
import { TOUCH_SLOP } from '@/utils/platform';

import { ReportModal, type ReportSubject } from './ReportModal';

export type MoreMenuAction = {
  label: string;
  onPress: () => void;
  /** 'danger' for delete / remove / block (deep red + ⚠); their confirm dialogs still follow. */
  variant?: 'default' | 'danger';
  disabled?: boolean;
};

/**
 * "⋯" that opens a small Options dialog: rarely used actions, then ⚑ Report, then red ones last,
 * so they are not one stray thumb away from ♥ / Reply. Renders nothing when
 * there's nothing to offer (e.g. a guest viewing someone else's content).
 */
export function MoreMenu({ report, actions = [], label }: { report?: ReportSubject; actions?: MoreMenuAction[]; label: string }) {
  const isGuest = useIsGuest();
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const canReport = report !== undefined && !isGuest;
  if (!canReport && actions.length === 0) return null;

  const pick = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More options for ${label}`}
        hitSlop={TOUCH_SLOP}
        onPress={() => setOpen(true)}
        className="min-h-[28px] min-w-[28px] items-center justify-center"
      >
        <Feather name="more-horizontal" size={16} color={themeColors.text} />
      </Pressable>
      <RetroGamingPCModal visible={open} title="Options" onClose={() => setOpen(false)}>
        <View className="gap-2">
          {actions.filter((a) => a.variant !== 'danger').map((a) => (
            <RetroGamingPCButton key={a.label} label={a.label} variant={a.variant ?? 'default'} disabled={a.disabled} onPress={() => pick(a.onPress)} />
          ))}
          {canReport ? (
            <RetroGamingPCButton label={`⚑ Report ${report.label}`} onPress={() => pick(() => setReporting(true))} />
          ) : null}
          {actions.filter((a) => a.variant === 'danger').map((a) => (
            <RetroGamingPCButton key={a.label} label={a.label} variant="danger" disabled={a.disabled} onPress={() => pick(a.onPress)} />
          ))}
        </View>
      </RetroGamingPCModal>
      {canReport ? <ReportModal subject={reporting ? report : null} onClose={() => setReporting(false)} /> : null}
    </>
  );
}
