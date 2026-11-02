import { Text, View } from 'react-native';

import { cn } from '@/utils/cn';

type ScoreBoxProps = {
  label: string;
  /** 0–100 scale. */
  score: number | null;
  /** e.g. "42 critics". */
  caption?: string;
};

/** Sunken numeric score tile, colored by band (2004-era review-aggregator look). */
export function ScoreBox({ label, score, caption }: ScoreBoxProps) {
  const band = score === null ? 'none' : score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
  return (
    <View className="min-w-[72px] items-center gap-0.5" accessibilityLabel={`${label}: ${score ?? 'no score'}`}>
      <View
        className={cn(
          'steam-bevel-inset h-11 w-14 items-center justify-center',
          band === 'high' && 'bg-steam-active',
          band === 'mid' && 'bg-steam-button',
          band === 'low' && 'bg-[#5a3a30]',
          band === 'none' && 'bg-steam-dark',
        )}
      >
        <Text className="font-mono text-steam-xl font-bold text-steam-text-bright">{score ?? '--'}</Text>
      </View>
      <Text className="steam-label">{label}</Text>
      {caption ? <Text className="text-steam-xs text-steam-text-muted">{caption}</Text> : null}
    </View>
  );
}
