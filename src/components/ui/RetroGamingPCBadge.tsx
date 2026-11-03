import { Text, View } from 'react-native';

import { ACTION_COLORS } from '@/constants/actionColors';
import { cn } from '@/utils/cn';

export type RetroGamingPCBadgeVariant = 'main' | 'draft' | 'nowPlaying' | 'published' | 'neutral';

export type RetroGamingPCBadgeProps = {
  label: string;
  variant?: RetroGamingPCBadgeVariant;
  className?: string;
};

const VARIANTS: Record<RetroGamingPCBadgeVariant, { box: string; text: string }> = {
  main: { box: 'bg-retrogamingpc-highlight border-retrogamingpc-text-bright', text: 'text-retrogamingpc-ink' },
  nowPlaying: { box: 'bg-retrogamingpc-active border-retrogamingpc-highlight', text: 'text-retrogamingpc-text-bright' },
  published: { box: 'bg-retrogamingpc-panel border-retrogamingpc-highlight', text: 'text-retrogamingpc-text-bright' },
  draft: { box: 'bg-retrogamingpc-dark border-retrogamingpc-accent', text: 'text-retrogamingpc-text-muted' },
  neutral: { box: 'bg-retrogamingpc-button border-retrogamingpc-button-border', text: 'text-retrogamingpc-text' },
};

/**
 * Status colours that mean the same thing in every theme:
 * published = solid green (like Save/Publish), draft = green outline (saved,
 * not public), now playing = blue. `main` keeps the theme colour; `neutral` is plain chrome.
 */
const FIXED: Partial<Record<RetroGamingPCBadgeVariant, { fill: string; label: string; border: string }>> = {
  published: { fill: ACTION_COLORS.save.fill, label: ACTION_COLORS.save.label, border: ACTION_COLORS.save.dark },
  draft: { fill: 'transparent', label: ACTION_COLORS.save.text, border: ACTION_COLORS.save.text },
  nowPlaying: { fill: ACTION_COLORS.navigate.fill, label: ACTION_COLORS.navigate.label, border: ACTION_COLORS.navigate.dark },
};

/** Compact uppercase status tag, e.g. MAIN PLATFORM / DRAFT / NOW PLAYING. */
export function RetroGamingPCBadge({ label, variant = 'neutral', className }: RetroGamingPCBadgeProps) {
  const v = VARIANTS[variant];
  const fixed = FIXED[variant];
  return (
    <View
      className={cn('self-start border px-1.5 py-px', !fixed && v.box, className)}
      style={fixed ? { backgroundColor: fixed.fill, borderColor: fixed.border } : undefined}
    >
      <Text
        className={cn('text-retrogamingpc-xs font-bold uppercase tracking-wider', !fixed && v.text)}
        style={fixed ? { color: fixed.label } : undefined}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}
