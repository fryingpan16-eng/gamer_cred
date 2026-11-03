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
          'retrogamingpc-bevel-inset h-11 w-14 items-center justify-center',
          band === 'high' && 'bg-retrogamingpc-active',
          band === 'mid' && 'bg-retrogamingpc-button',
          band === 'low' && 'bg-[#5a3a30]',
          band === 'none' && 'bg-retrogamingpc-dark',
        )}
      >
        <Text className="font-mono text-retrogamingpc-xl font-bold text-retrogamingpc-text-bright">{score ?? '--'}</Text>
      </View>
      <Text className="retrogamingpc-label">{label}</Text>
      {caption ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{caption}</Text> : null}
    </View>
  );
}
