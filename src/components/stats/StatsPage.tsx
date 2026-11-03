import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { RetroGamingPCPanel, RetroGamingPCTabs } from '@/components/ui';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import { cn } from '@/utils/cn';

import { findStat, STATS, type StatDefinition } from './statsConfig';

type StatsPageProps = {
  /** Selected stat id (falls back to the first stat). */
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  /** Override the menu (tests, future filtering). */
  stats?: readonly StatDefinition[];
};

function MenuItem({ stat, active, onPress, vertical }: { stat: StatDefinition; active: boolean; onPress: () => void; vertical: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      className={cn(
        'border',
        vertical ? 'px-2 py-1.5' : 'px-3 py-1',
        active ? 'border-retrogamingpc-highlight bg-retrogamingpc-card' : cn('border-retrogamingpc-accent', hovered ? 'bg-retrogamingpc-panel' : 'bg-retrogamingpc-button'),
      )}
    >
      <Text className={cn('text-retrogamingpc-sm', active ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text')} numberOfLines={1}>
        {stat.title}
      </Text>
    </Pressable>
  );
}

/**
 * Stats: a menu (sidebar on desktop, scrollable strip on mobile) driven by
 * STATS, and the selected stat in the main panel. Only the selected stat's
 * component is mounted, so only it fetches/computes its data.
 */
export function StatsPage({ selectedId, onSelect, stats = STATS }: StatsPageProps) {
  const isDesktop = useIsDesktop();
  const selected = stats.find((s) => s.id === selectedId) ?? stats[0] ?? findStat(undefined);
  const Selected = selected.component;

  const menu = stats.map((s) => (
    <MenuItem key={s.id} stat={s} active={s.id === selected.id} onPress={() => onSelect(s.id)} vertical />
  ));
  const tabItems = stats.map((s) => ({ key: s.id, label: s.title }));

  return (
    <View className={cn('flex-1 bg-retrogamingpc-dark', isDesktop && 'flex-row')}>
      {isDesktop ? (
        <View role="tablist" accessibilityRole="tablist" className="w-[190px] gap-1 border-r border-r-retrogamingpc-bevel-dark p-2">
          <Text className="retrogamingpc-label px-1 pb-1">Stats</Text>
          {menu}
        </View>
      ) : (
        // Same header strip as Home; many charts, so the tabs scroll with ◀ / ▶ hints.
        <View className="gap-1 border-b border-b-retrogamingpc-accent px-3 pt-3 pb-2">
          <RetroGamingPCTabs items={tabItems} value={selected.id} onChange={onSelect} />
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
            {stats.length} charts · swipe or use ◀ ▶ to see more
          </Text>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerClassName="gap-3 p-3">
        <RetroGamingPCPanel title={selected.title}>
          <View className="gap-3">
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{selected.description}</Text>
            {/* key: remount on switch so the previous stat's hooks stop entirely */}
            <Selected key={selected.id} />
          </View>
        </RetroGamingPCPanel>
      </ScrollView>
    </View>
  );
}
