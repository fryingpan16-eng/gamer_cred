import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';
import { useThemeColors } from '@/hooks/useTheme';

const SHOW_SAVED_MS = 2500;

export type RetroGamingPCSaveStatusProps = {
  /** A save is in flight. */
  pending: boolean;
  /**
   * When the last successful save was submitted (TanStack `mutation.submittedAt`
   * while `isSuccess`), or null. Each new value shows "✓ Saved" briefly.
   */
  savedAt: number | null;
  className?: string;
};

/**
 * Inline auto-save feedback: "Saving…" while a change is in flight, then
 * "✓ Saved" for a moment. Fixed height so it never shifts the layout.
 * (Errors are shown by the setting's own alert.)
 */
export function RetroGamingPCSaveStatus({ pending, savedAt, className }: RetroGamingPCSaveStatusProps) {
  const themeColors = useThemeColors();
  const [hiddenFor, setHiddenFor] = useState<number | null>(null);

  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setHiddenFor(savedAt), SHOW_SAVED_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const showSaved = !pending && savedAt !== null && hiddenFor !== savedAt;

  return (
    <View className={cn('h-3.5 justify-center', className)} accessibilityLiveRegion="polite">
      {pending ? (
        <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">Saving…</Text>
      ) : showSaved ? (
        <Text className="font-mono text-retrogamingpc-xs font-bold" style={{ color: themeColors.saveText }}>
          ✓ Saved
        </Text>
      ) : null}
    </View>
  );
}

/** Props for RetroGamingPCSaveStatus straight from a TanStack mutation result. */
export function saveStatusOf(mutation: { isPending: boolean; isSuccess: boolean; submittedAt: number }): RetroGamingPCSaveStatusProps {
  return { pending: mutation.isPending, savedAt: mutation.isSuccess ? mutation.submittedAt : null };
}
