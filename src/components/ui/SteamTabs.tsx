import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { cn } from '@/utils/cn';

export type SteamTabItem<K extends string> = {
  key: K;
  label: string;
  /** Optional count shown after the label, e.g. search hits. */
  count?: number;
};

export type SteamTabsProps<K extends string> = {
  items: readonly SteamTabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Stretch tabs to fill the row (mobile segmented look). Default false. */
  fill?: boolean;
  className?: string;
};

function TabButton<K extends string>({
  item,
  active,
  fill,
  onPress,
}: {
  item: SteamTabItem<K>;
  active: boolean;
  fill: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      role="tab"
      aria-selected={active}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={cn(
        // Identical border widths in both states: only colors change, so no layout shift.
        '-mb-px items-center border border-b px-3 py-1',
        fill && 'flex-1',
        active
          ? 'border-steam-highlight border-b-steam-card bg-steam-card'
          : cn('border-steam-accent border-b-steam-accent', hovered ? 'bg-steam-panel' : 'bg-steam-button'),
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          'text-steam-sm',
          active ? 'font-bold text-steam-text-bright' : 'text-steam-text-muted',
        )}
      >
        {item.label}
        {item.count !== undefined ? <Text className="font-mono"> ({item.count})</Text> : null}
      </Text>
    </Pressable>
  );
}

/** Segmented sub-tab bar with classic folder-tab styling (e.g. Search: Games / Studios / Users). */
export function SteamTabs<K extends string>({ items, value, onChange, fill = false, className }: SteamTabsProps<K>) {
  return (
    <View role="tablist" className={cn('flex-row gap-0.5 border-b border-b-steam-accent', className)}>
      {items.map((item) => (
        <TabButton
          key={item.key}
          item={item}
          active={item.key === value}
          fill={fill}
          onPress={() => onChange(item.key)}
        />
      ))}
    </View>
  );
}
