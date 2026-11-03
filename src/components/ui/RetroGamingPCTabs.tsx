import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/utils/cn';
import { TOUCH_SLOP } from '@/utils/platform';

export type RetroGamingPCTabItem<K extends string> = {
  key: K;
  label: string;
  /** Optional count shown after the label, e.g. search hits. */
  count?: number;
};

export type RetroGamingPCTabsProps<K extends string> = {
  items: readonly RetroGamingPCTabItem<K>[];
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
  item: RetroGamingPCTabItem<K>;
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
        '-mb-px min-h-[32px] items-center justify-center border border-b px-3 py-1',
        fill && 'flex-1',
        active
          ? 'border-retrogamingpc-highlight border-b-retrogamingpc-card bg-retrogamingpc-card'
          : cn('border-retrogamingpc-accent border-b-retrogamingpc-accent', hovered ? 'bg-retrogamingpc-panel' : 'bg-retrogamingpc-button'),
      )}
    >
      <Text
        numberOfLines={1}
        className={cn(
          'text-retrogamingpc-sm',
          active ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted',
        )}
      >
        {item.label}
        {item.count !== undefined ? <Text className="font-mono"> ({item.count})</Text> : null}
      </Text>
    </Pressable>
  );
}

/** Edge button shown when more tabs are hidden on that side; tap to scroll that way. */
function ScrollArrow({ side, onPress }: { side: 'left' | 'right'; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={side === 'left' ? 'Scroll tabs left' : 'Scroll tabs right'}
      onPress={onPress}
      hitSlop={TOUCH_SLOP}
      className={cn(
        'absolute bottom-0 top-0 w-8 items-center justify-center bg-retrogamingpc-panel',
        side === 'left' ? 'left-0 border-r border-r-retrogamingpc-highlight' : 'right-0 border-l border-l-retrogamingpc-highlight',
      )}
    >
      <Text className="text-retrogamingpc-base font-bold text-retrogamingpc-text-bright">{side === 'left' ? '◀' : '▶'}</Text>
    </Pressable>
  );
}

/** Pixels of slack before an edge counts as "more to scroll". */
const EDGE_SLOP = 4;

/**
 * Natural-width tabs that scroll sideways (e.g. Stats' many charts). ◀ / ▶ edge
 * buttons appear whenever tabs are hidden on that side, and the selected tab is
 * scrolled into view, so it's obvious there is more to see.
 */
function ScrollingTabs<K extends string>({ items, value, onChange, className }: RetroGamingPCTabsProps<K>) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const tabX = useRef(new Map<K, { x: number; width: number }>());
  const [viewWidth, setViewWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [offset, setOffset] = useState(0);

  const canLeft = offset > EDGE_SLOP;
  const canRight = offset + viewWidth < contentWidth - EDGE_SLOP;

  // Keep the selected tab visible (e.g. arriving at a deep-linked stat).
  useEffect(() => {
    const tab = tabX.current.get(value);
    if (!tab || viewWidth === 0) return;
    const pad = 36; // clear of the edge arrow
    if (tab.x - pad < offset) scrollRef.current?.scrollTo({ x: Math.max(0, tab.x - pad), animated: true });
    else if (tab.x + tab.width + pad > offset + viewWidth) scrollRef.current?.scrollTo({ x: tab.x + tab.width + pad - viewWidth, animated: true });
    // Only when the selection or layout changes, not on every scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, viewWidth, contentWidth]);

  const page = (dir: 1 | -1) =>
    scrollRef.current?.scrollTo({ x: Math.max(0, Math.min(contentWidth - viewWidth, offset + dir * viewWidth * 0.7)), animated: true });

  return (
    <View role="tablist" className={cn('border-b border-b-retrogamingpc-accent', className)} onLayout={(e) => setViewWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-0.5"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.x)}
        onContentSizeChange={(w) => setContentWidth(w)}
      >
        {items.map((item) => (
          <View key={item.key} onLayout={(e) => tabX.current.set(item.key, { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width })}>
            <TabButton item={item} active={item.key === value} fill={false} onPress={() => onChange(item.key)} />
          </View>
        ))}
      </ScrollView>
      {canLeft ? <ScrollArrow side="left" onPress={() => page(-1)} /> : null}
      {canRight ? <ScrollArrow side="right" onPress={() => page(1)} /> : null}
    </View>
  );
}

/**
 * Folder-tab bar (Home: Community / Friends / Lists). `fill` stretches a few tabs
 * across the row; otherwise tabs keep their natural width and scroll sideways
 * with ◀ / ▶ hints when they don't fit.
 */
export function RetroGamingPCTabs<K extends string>(props: RetroGamingPCTabsProps<K>) {
  const { items, value, onChange, fill = false, className } = props;
  if (!fill) return <ScrollingTabs {...props} />;
  return (
    <View role="tablist" className={cn('flex-row gap-0.5 border-b border-b-retrogamingpc-accent', className)}>
      {items.map((item) => (
        <TabButton key={item.key} item={item} active={item.key === value} fill onPress={() => onChange(item.key)} />
      ))}
    </View>
  );
}
