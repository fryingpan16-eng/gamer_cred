import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type SteamBadgeVariant = 'main' | 'draft' | 'nowPlaying' | 'published' | 'neutral';

export type SteamBadgeProps = {
  label: string;
  variant?: SteamBadgeVariant;
  className?: string;
};

const VARIANTS: Record<SteamBadgeVariant, { box: string; text: string }> = {
  main: { box: 'bg-steam-highlight border-steam-text-bright', text: 'text-steam-dark' },
  nowPlaying: { box: 'bg-steam-active border-steam-highlight', text: 'text-steam-text-bright' },
  published: { box: 'bg-steam-panel border-steam-highlight', text: 'text-steam-highlight' },
  draft: { box: 'bg-steam-dark border-steam-accent', text: 'text-steam-text-muted' },
  neutral: { box: 'bg-steam-button border-steam-button-border', text: 'text-steam-text' },
};

/** Compact uppercase status tag, e.g. MAIN PLATFORM / DRAFT / NOW PLAYING. */
export function SteamBadge({ label, variant = 'neutral', className }: SteamBadgeProps) {
  const v = VARIANTS[variant];
  return (
    <View className={cn('self-start border px-1.5 py-px', v.box, className)}>
      <Text className={cn('text-steam-xs font-bold uppercase tracking-wider', v.text)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
