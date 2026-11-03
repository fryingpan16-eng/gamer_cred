import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type RetroGamingPCBadgeVariant = 'main' | 'draft' | 'nowPlaying' | 'published' | 'neutral';

export type RetroGamingPCBadgeProps = {
  label: string;
  variant?: RetroGamingPCBadgeVariant;
  className?: string;
};

const VARIANTS: Record<RetroGamingPCBadgeVariant, { box: string; text: string }> = {
  main: { box: 'bg-retrogamingpc-highlight border-retrogamingpc-text-bright', text: 'text-retrogamingpc-dark' },
  nowPlaying: { box: 'bg-retrogamingpc-active border-retrogamingpc-highlight', text: 'text-retrogamingpc-text-bright' },
  published: { box: 'bg-retrogamingpc-panel border-retrogamingpc-highlight', text: 'text-retrogamingpc-highlight' },
  draft: { box: 'bg-retrogamingpc-dark border-retrogamingpc-accent', text: 'text-retrogamingpc-text-muted' },
  neutral: { box: 'bg-retrogamingpc-button border-retrogamingpc-button-border', text: 'text-retrogamingpc-text' },
};

/** Compact uppercase status tag, e.g. MAIN PLATFORM / DRAFT / NOW PLAYING. */
export function RetroGamingPCBadge({ label, variant = 'neutral', className }: RetroGamingPCBadgeProps) {
  const v = VARIANTS[variant];
  return (
    <View className={cn('self-start border px-1.5 py-px', v.box, className)}>
      <Text className={cn('text-retrogamingpc-xs font-bold uppercase tracking-wider', v.text)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
