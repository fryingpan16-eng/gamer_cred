import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { cn } from '@/utils/cn';
import type { BarDatum } from '@/utils/stats';

export type RetroGamingPCBarChartProps = {
  /** Used for the accessibility summary and the table caption. */
  title: string;
  data: readonly BarDatum[];
  orientation?: 'vertical' | 'horizontal';
  /** Show only the first N bars until "Show all" is pressed. */
  topN?: number;
  /** Render the "Show all" toggle when there are more than `topN` bars (or `totalCount` says so). */
  showAllToggle?: boolean;
  /**
   * Controlled "show all" (e.g. Studios fetches the complete list from the server
   * only when expanded). Omit both to let the chart slice `data` locally.
   */
  showAll?: boolean;
  onShowAllChange?: (showAll: boolean) => void;
  /** Total bars available when `data` is only the first page (controlled mode). */
  totalCount?: number;
  /** Unit for tooltips / table, e.g. "games". */
  unit?: string;
  formatValue?: (value: number) => string;
  /** Max height of the scroll area for long horizontal lists. */
  maxHeight?: number;
  /** Width of the label column in horizontal charts (default 38%). */
  labelWidth?: number | `${number}%`;
  className?: string;
};

const VERTICAL_HEIGHT = 150;
const SCROLL_VERTICAL_AFTER = 12; // more bars than this → fixed-width bars in a horizontal scroll
const VERTICAL_BAR_WIDTH = 34; // fits a 10px label like "NOT GOOD" over two lines

/**
 * Reusable retro bar chart (plain Views, works on iOS/Android/web, no chart lib).
 * Tap or hover a bar for its exact value; "Table" switches to a text table that
 * is also what screen readers get.
 */
export function RetroGamingPCBarChart({
  title,
  data,
  orientation = 'vertical',
  topN,
  showAllToggle = false,
  showAll: showAllProp,
  onShowAllChange,
  totalCount,
  unit = 'games',
  formatValue = (v) => String(v),
  maxHeight = 420,
  labelWidth = '38%',
  className,
}: RetroGamingPCBarChartProps) {
  const [localShowAll, setLocalShowAll] = useState(false);
  const [asTable, setAsTable] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const controlled = showAllProp !== undefined;
  const showAll = controlled ? showAllProp : localShowAll;
  const setShowAll = (next: boolean) => (controlled ? onShowAllChange?.(next) : setLocalShowAll(next));

  const available = totalCount ?? data.length;
  const visible = topN !== undefined && !showAll ? data.slice(0, topN) : data;
  const canToggle = showAllToggle && topN !== undefined && available > topN;
  const max = Math.max(1, ...visible.map((d) => d.value));
  const selectedDatum = visible.find((d) => d.key === selected) ?? null;

  const summary = `${title}: ${visible
    .slice(0, 5)
    .map((d) => `${d.label} ${formatValue(d.value)}`)
    .join(', ')}${visible.length > 5 ? `, and ${visible.length - 5} more` : ''}. Use the Table button for every value.`;

  const header = (
    <View className="flex-row items-center justify-between gap-2">
      {/* Tooltip line: fixed height so selecting a bar never shifts the chart. */}
      <Text className="h-4 flex-1 text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={1} accessibilityLiveRegion="polite">
        {selectedDatum
          ? `${selectedDatum.label}: ${formatValue(selectedDatum.value)} ${unit}${selectedDatum.detail ? ` · ${selectedDatum.detail}` : ''}`
          : asTable
            ? ''
            : 'Tap a bar for its exact value'}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={asTable ? `Show ${title} as a chart` : `Show ${title} as a table`}
        onPress={() => setAsTable((v) => !v)}
        hitSlop={6}
      >
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">{asTable ? 'Chart' : 'Table'}</Text>
      </Pressable>
    </View>
  );

  const toggle = canToggle ? (
    <Pressable accessibilityRole="button" onPress={() => setShowAll(!showAll)} className="self-start pt-1" hitSlop={6}>
      <Text className="text-retrogamingpc-sm text-retrogamingpc-text-bright underline">
        {showAll ? `Show top ${topN}` : `Show all ${available}`}
      </Text>
    </Pressable>
  ) : null;

  if (asTable) {
    return (
      <View className={cn('gap-2', className)}>
        {header}
        <ScrollView style={{ maxHeight }} nestedScrollEnabled>
          <View accessibilityRole="list" accessibilityLabel={`${title} table`}>
            <View className="flex-row border-b border-b-retrogamingpc-accent pb-1">
              <Text className="flex-1 text-retrogamingpc-xs font-bold text-retrogamingpc-text-muted">{title}</Text>
              <Text className="w-20 text-right text-retrogamingpc-xs font-bold text-retrogamingpc-text-muted">{unit}</Text>
            </View>
            {visible.map((d) => (
              <View key={d.key} accessible accessibilityLabel={`${d.label}: ${formatValue(d.value)} ${unit}${d.detail ? `, ${d.detail}` : ''}`} className="flex-row border-b border-b-retrogamingpc-accent py-1">
                <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text" numberOfLines={2}>
                  {d.label}
                  {d.detail ? <Text className="text-retrogamingpc-text-muted"> · {d.detail}</Text> : null}
                </Text>
                <Text className="w-20 text-right font-mono text-retrogamingpc-sm text-retrogamingpc-text-bright">{formatValue(d.value)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        {toggle}
      </View>
    );
  }

  const barPress = (key: string) => setSelected((cur) => (cur === key ? null : key));

  const chart =
    orientation === 'horizontal' ? (
      <ScrollView style={{ maxHeight }} nestedScrollEnabled>
        <View className="gap-1">
          {visible.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => barPress(d.key)}
              onHoverIn={() => setSelected(d.key)}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              className="flex-row items-center gap-2"
            >
              {d.color && d.labelTextColor ? (
                // Tier-list chip: label on its tier colour.
                <View className="h-4 justify-center border px-1" style={{ width: labelWidth, backgroundColor: d.color, borderColor: 'rgba(0,0,0,0.35)' }}>
                  <Text className="text-center font-mono text-retrogamingpc-xs font-bold" style={{ color: d.labelTextColor }} numberOfLines={1}>
                    {d.label}
                  </Text>
                </View>
              ) : (
                <Text className="text-retrogamingpc-xs text-retrogamingpc-text" style={{ width: labelWidth }} numberOfLines={1}>
                  {d.label}
                </Text>
              )}
              <View className="h-4 flex-1 justify-center bg-retrogamingpc-dark">
                <View
                  className={cn('h-full', !d.color && 'bg-retrogamingpc-highlight', selected === d.key && 'opacity-70')}
                  style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, ...(d.color ? { backgroundColor: d.color } : {}) }}
                />
              </View>
              <Text className="w-10 text-right font-mono text-retrogamingpc-xs text-retrogamingpc-text-bright">{formatValue(d.value)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    ) : (
      (() => {
        const scroll = visible.length > SCROLL_VERTICAL_AFTER;
        const bars = (
          <View className="flex-row items-end gap-1" style={{ height: VERTICAL_HEIGHT }}>
            {visible.map((d) => (
              <Pressable
                key={d.key}
                onPress={() => barPress(d.key)}
                onHoverIn={() => setSelected(d.key)}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-full items-center justify-end"
                style={scroll ? { width: VERTICAL_BAR_WIDTH } : { flex: 1 }}
              >
                <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-bright">{d.value > 0 ? formatValue(d.value) : ''}</Text>
                <View
                  className={cn('w-full', !d.color && 'bg-retrogamingpc-highlight', selected === d.key && 'opacity-70')}
                  style={{ height: `${Math.max(d.value > 0 ? 3 : 1, (d.value / max) * 80)}%`, ...(d.color ? { backgroundColor: d.color } : {}) }}
                />
                {d.color && d.labelTextColor ? (
                  <View className="mt-px h-7 w-full items-center justify-center border" style={{ backgroundColor: d.color, borderColor: 'rgba(0,0,0,0.35)' }}>
                    <Text className="text-center font-mono text-retrogamingpc-xs font-bold" style={{ color: d.labelTextColor }} numberOfLines={2}>
                      {d.label}
                    </Text>
                  </View>
                ) : (
                  <Text className="h-7 text-center text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={2}>
                    {d.label}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        );
        return scroll ? (
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            {bars}
          </ScrollView>
        ) : (
          bars
        );
      })()
    );

  return (
    <View className={cn('gap-2', className)}>
      {header}
      <View accessible accessibilityRole="image" accessibilityLabel={summary}>
        {chart}
      </View>
      {toggle}
    </View>
  );
}
