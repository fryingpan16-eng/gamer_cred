import { Link } from 'expo-router';
import { Text, View } from 'react-native';

import { SteamPanel } from '@/components/ui';
import type { SystemRequirementLine, SystemRequirements } from '@/types/igdb';

function RequirementColumn({ title, rows }: { title: string; rows: SystemRequirementLine[] }) {
  return (
    <View className="steam-bevel-inset flex-1 bg-steam-dark">
      <View className="border-b border-b-steam-accent bg-steam-panel px-2 py-0.5">
        <Text className="text-steam-xs font-bold uppercase tracking-wider text-steam-text-bright">{title}</Text>
      </View>
      <View className="gap-0.5 p-2">
        {rows.length === 0 ? (
          <Text className="font-mono text-steam-xs text-steam-text-muted">Not listed.</Text>
        ) : (
          rows.map((row, i) => (
            <View key={`${row.label ?? 'note'}-${i}`} className="flex-row gap-2">
              {row.label ? <Text className="w-[84px] font-mono text-steam-xs text-steam-text-muted">{row.label}:</Text> : null}
              <Text className="flex-1 font-mono text-steam-xs text-steam-text" selectable>
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
    <SteamPanel title="System Requirements (PC)">
      {requirements ? (
        <View className="gap-2">
          <View className="gap-2 md:flex-row">
            <RequirementColumn title="Minimum" rows={requirements.minimum} />
            <RequirementColumn title="Recommended" rows={requirements.recommended} />
          </View>
          <Text className="text-right text-steam-xs text-steam-text-muted">
            Requirements via{' '}
            <Link href={requirements.sourceUrl as `https://${string}`} target="_blank" className="text-steam-highlight underline">
              RAWG
            </Link>
          </Text>
        </View>
      ) : (
        <Text className="text-steam-sm text-steam-text-muted">No PC requirements are listed for this game yet.</Text>
      )}
    </SteamPanel>
  );
}
