import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCPanel } from '@/components/ui';
import type { SystemRequirementLine, SystemRequirements } from '@/types/igdb';

function RequirementColumn({ title, rows }: { title: string; rows: SystemRequirementLine[] }) {
  return (
    <View className="retrogamingpc-bevel-inset flex-1 bg-retrogamingpc-dark">
      <View className="border-b border-b-retrogamingpc-accent bg-retrogamingpc-panel px-2 py-0.5">
        <Text className="text-retrogamingpc-xs font-bold uppercase tracking-wider text-retrogamingpc-text-bright">{title}</Text>
      </View>
      <View className="gap-0.5 p-2">
        {rows.length === 0 ? (
          <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">Not listed.</Text>
        ) : (
          rows.map((row, i) => (
            <View key={`${row.label ?? 'note'}-${i}`} className="flex-row gap-2">
              {row.label ? <Text className="w-[84px] font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{row.label}:</Text> : null}
              <Text className="flex-1 font-mono text-retrogamingpc-xs text-retrogamingpc-text" selectable>
                {row.value}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

/** Minimum / Recommended PC requirements (from RAWG), in the classic sunken spec boxes. */
export function SystemRequirementsPanel({ requirements, hasPc }: { requirements: SystemRequirements | null; hasPc: boolean }) {
  if (!hasPc) return null;
  return (
    <RetroGamingPCPanel title="System Requirements (PC)">
      {requirements ? (
        <View className="gap-2">
          <View className="gap-2 md:flex-row">
            <RequirementColumn title="Minimum" rows={requirements.minimum} />
            <RequirementColumn title="Recommended" rows={requirements.recommended} />
          </View>
          <Text className="text-right text-retrogamingpc-xs text-retrogamingpc-text-muted">
            Requirements via{' '}
            <Link href={requirements.sourceUrl as `https://${string}`} target="_blank" className="text-retrogamingpc-highlight underline">
              RAWG
            </Link>
          </Text>
        </View>
      ) : (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No PC requirements are listed for this game yet.</Text>
      )}
    </RetroGamingPCPanel>
  );
}
