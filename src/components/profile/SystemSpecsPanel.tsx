import { Text, View } from 'react-native';

import { PC_SPEC_FIELDS, type PcSpecs } from '@/utils/profileSchemas';

/** 2004-Steam "System Information" readout: sunken label/value table in monospace. */
export function SystemSpecsPanel({ title, specs }: { title: string; specs: PcSpecs }) {
  const rows = PC_SPEC_FIELDS.filter((f) => specs[f.key].length > 0);
  return (
    <View className="steam-bevel-inset bg-steam-dark">
      <View className="border-b border-b-steam-accent bg-steam-panel px-2 py-0.5">
        <Text className="text-steam-xs font-bold uppercase tracking-wider text-steam-text-bright">
          System Information — {title}
        </Text>
      </View>
      <View className="gap-0.5 p-2">
        {rows.length === 0 ? (
          <Text className="font-mono text-steam-xs text-steam-text-muted">No specs entered.</Text>
        ) : (
          rows.map((field) => (
            <View key={field.key} className="flex-row gap-2">
              <Text className="w-[84px] font-mono text-steam-xs text-steam-text-muted">{field.label}:</Text>
              <Text className="flex-1 font-mono text-steam-xs text-steam-text" selectable>
                {specs[field.key]}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
