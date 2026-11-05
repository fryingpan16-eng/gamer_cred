import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { PlaysTag } from '@/components/replays/PlaysTag';
import { RetroGamingPCButton, RetroGamingPCTabs, type RetroGamingPCTabItem } from '@/components/ui';
import { RATING_TIERS, type TierCode } from '@/constants/ratingRubric';
import { useThemeColors } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';
import { noZoomInputStyle } from '@/utils/platform';
import { formatStars, tierDefinition, tierBorderColor, tierSpokenName } from '@/utils/rating';
import {
  activeFilterCount,
  applyTable,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  facet,
  nextSort,
  type RatingsTableRow,
  type ReviewFilter,
  type SortKey,
  type TableFilters,
  type TableSort,
} from '@/utils/ratingsTable';

type Column = { key: string; label: string; width: number; sort: SortKey; align?: 'right' | 'center' };

/** Spreadsheet columns. Score, Tier and Stars all sort by the 1–100 score. */
const COLUMNS: readonly Column[] = [
  { key: 'name', label: 'Game', width: 220, sort: 'name' },
  { key: 'score', label: '1–100', width: 58, sort: 'score', align: 'right' },
  { key: 'tier', label: 'Tier', width: 52, sort: 'score', align: 'center' },
  { key: 'stars', label: 'Stars', width: 54, sort: 'score', align: 'right' },
  { key: 'platform', label: 'Played on', width: 84, sort: 'platform' },
  { key: 'year', label: 'Year', width: 50, sort: 'year', align: 'right' },
  { key: 'genre', label: 'Genre', width: 130, sort: 'genre' },
  { key: 'developer', label: 'Developer', width: 140, sort: 'developer' },
  { key: 'rated', label: 'Rated', width: 88, sort: 'rated', align: 'right' },
  { key: 'review', label: 'Review', width: 62, sort: 'review', align: 'center' },
];
const TABLE_WIDTH = COLUMNS.reduce((w, c) => w + c.width, 0);
const ROW_HEIGHT = 30;
const DIVIDER = 'rgba(255,255,255,0.12)';

const REVIEW_TABS: readonly RetroGamingPCTabItem<ReviewFilter>[] = [
  { key: 'any', label: 'Any' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'notReviewed', label: 'Not reviewed' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterChip({ label, count, selected, onPress, color, textColor }: { label: string; count?: number; selected: boolean; onPress: () => void; color?: string; textColor?: string }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}${count !== undefined ? `, ${count} games` : ''}`}
      onPress={onPress}
      className={cn('min-h-[28px] flex-row items-center gap-1 border px-2', selected ? 'border-2 border-retrogamingpc-text-bright' : 'border-retrogamingpc-accent')}
      style={color ? { backgroundColor: color, opacity: selected ? 1 : 0.6 } : undefined}
    >
      <Text
        className={cn('text-retrogamingpc-xs', selected ? 'font-bold' : '', !textColor && (selected ? 'text-retrogamingpc-text-bright' : 'text-retrogamingpc-text'))}
        style={textColor ? { color: textColor } : undefined}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text className={cn('font-mono text-retrogamingpc-xs', !textColor && 'text-retrogamingpc-text-muted')} style={textColor ? { color: textColor } : undefined}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-1">
      <Text className="retrogamingpc-label">{title}</Text>
      <View className="flex-row flex-wrap gap-1">{children}</View>
    </View>
  );
}

function ScoreBound({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const themeColors = useThemeColors();
  const [text, setText] = useState(value === null ? '' : String(value));
  const commit = (t: string) => {
    setText(t);
    const n = /^\d{1,3}$/.test(t.trim()) ? Number(t.trim()) : NaN;
    onChange(t.trim() === '' || !(n >= 1 && n <= 100) ? null : n);
  };
  return (
    <View className="flex-row items-center gap-1">
      <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{label}</Text>
      <TextInput
          style={noZoomInputStyle}
        value={text}
        onChangeText={commit}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
        placeholder="—"
        placeholderTextColor={themeColors.textMuted}
        accessibilityLabel={`${label} score, 1 to 100`}
        className="retrogamingpc-input h-7 w-12 text-center font-mono outline-none"
      />
    </View>
  );
}

function Filters({ rows, filters, onChange }: { rows: readonly RatingsTableRow[]; filters: TableFilters; onChange: (f: TableFilters) => void }) {
  const platforms = useMemo(() => facet(rows, (r) => [r.platform]), [rows]);
  const genres = useMemo(() => facet(rows, (r) => r.genres), [rows]);
  const tierCounts = useMemo(() => new Map(facet(rows, (r) => [r.tier]).map((f) => [f.value, f.count])), [rows]);
  const [allGenres, setAllGenres] = useState(false);
  const shownGenres = allGenres ? genres : genres.slice(0, 14);

  return (
    <View className="retrogamingpc-bevel-inset gap-3 bg-retrogamingpc-dark p-2">
      <FilterGroup title="Tier">
        {RATING_TIERS.map((t) => (
          <FilterChip
            key={t.tier}
            label={t.label}
            count={tierCounts.get(t.tier) ?? 0}
            color={t.color}
            textColor={t.textColor}
            selected={filters.tiers.includes(t.tier)}
            onPress={() => onChange({ ...filters, tiers: toggle<TierCode>(filters.tiers, t.tier) })}
          />
        ))}
      </FilterGroup>
      <FilterGroup title="Score (1–100)">
        <ScoreBound label="from" value={filters.minScore} onChange={(minScore) => onChange({ ...filters, minScore })} />
        <ScoreBound label="to" value={filters.maxScore} onChange={(maxScore) => onChange({ ...filters, maxScore })} />
      </FilterGroup>
      <FilterGroup title="Played on">
        {platforms.map((p) => (
          <FilterChip key={p.value} label={p.value} count={p.count} selected={filters.platforms.includes(p.value)} onPress={() => onChange({ ...filters, platforms: toggle(filters.platforms, p.value) })} />
        ))}
      </FilterGroup>
      <FilterGroup title="Genre">
        {shownGenres.map((g) => (
          <FilterChip key={g.value} label={g.value} count={g.count} selected={filters.genres.includes(g.value)} onPress={() => onChange({ ...filters, genres: toggle(filters.genres, g.value) })} />
        ))}
        {genres.length > 14 ? (
          <Pressable accessibilityRole="button" onPress={() => setAllGenres((v) => !v)} className="min-h-[28px] justify-center px-1">
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">{allGenres ? 'Fewer' : `All ${genres.length}…`}</Text>
          </Pressable>
        ) : null}
      </FilterGroup>
      <View className="gap-1">
        <Text className="retrogamingpc-label">Review</Text>
        <RetroGamingPCTabs items={REVIEW_TABS} value={filters.reviewed} onChange={(reviewed) => onChange({ ...filters, reviewed })} fill />
      </View>
    </View>
  );
}

function HeaderCell({ column, sort, canSort, onSort }: { column: Column; sort: TableSort; canSort: boolean; onSort: (k: SortKey) => void }) {
  // Tier / Stars share the score sort; show the arrow on the 1–100 column only.
  const active = canSort && sort.key === column.sort && (column.sort !== 'score' || column.key === 'score');
  const content = (
    <Text
      className={cn('text-retrogamingpc-xs font-bold uppercase', active ? 'text-retrogamingpc-text-bright' : 'text-retrogamingpc-text', column.align === 'right' && 'text-right', column.align === 'center' && 'text-center')}
      numberOfLines={1}
    >
      {column.label}
      {active ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </Text>
  );
  const cellClass = 'h-8 justify-center border-r px-1.5';
  if (!canSort) {
    return (
      <View style={{ width: column.width, borderRightColor: DIVIDER }} className={cellClass}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${column.label}${active ? (sort.dir === 'asc' ? ', ascending' : ', descending') : ''}`}
      onPress={() => onSort(column.sort)}
      style={{ width: column.width, borderRightColor: DIVIDER }}
      className={cellClass}
    >
      {content}
    </Pressable>
  );
}

function Cell({ width, align, children }: { width: number; align?: 'right' | 'center'; children: ReactNode }) {
  return (
    <View style={{ width, borderRightColor: DIVIDER }} className={cn('h-full justify-center border-r px-1.5', align === 'right' && 'items-end', align === 'center' && 'items-center')}>
      {children}
    </View>
  );
}

const cellText = 'text-retrogamingpc-xs text-retrogamingpc-text';

function Row({ row, index }: { row: RatingsTableRow; index: number }) {
  const tier = tierDefinition(row.tier);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${row.name}: ${row.score} out of 100, tier ${tierSpokenName(row.tier)}, played on ${row.platform}${row.replays > 0 ? `, played ${row.replays + 1} times` : ''}. Open game page`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: String(row.gameId) } })}
      style={{ height: ROW_HEIGHT, borderBottomColor: DIVIDER }}
      className={cn('flex-row border-b', index % 2 === 1 ? 'bg-retrogamingpc-card' : 'bg-retrogamingpc-dark')}
    >
      <Cell width={COLUMNS[0]!.width}>
        <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
          {row.name}
          <PlaysTag replays={row.replays} />
        </Text>
      </Cell>
      <Cell width={COLUMNS[1]!.width} align="right">
        <Text className="font-mono text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright">{row.score}</Text>
      </Cell>
      <Cell width={COLUMNS[2]!.width} align="center">
        <View className="min-w-[30px] items-center border px-1" style={{ backgroundColor: tier.color, borderColor: tierBorderColor(row.tier) }}>
          <Text className="font-mono text-retrogamingpc-xs font-bold" style={{ color: tier.textColor }}>
            {tier.label}
          </Text>
        </View>
      </Cell>
      <Cell width={COLUMNS[3]!.width} align="right">
        <Text className={cn(cellText, 'font-mono')}>{formatStars(row.stars)}</Text>
      </Cell>
      <Cell width={COLUMNS[4]!.width}>
        <Text className={cellText} numberOfLines={1}>
          {row.platform}
        </Text>
      </Cell>
      <Cell width={COLUMNS[5]!.width} align="right">
        <Text className={cn(cellText, 'font-mono')}>{row.year ?? '—'}</Text>
      </Cell>
      <Cell width={COLUMNS[6]!.width}>
        <Text className={cellText} numberOfLines={1}>
          {row.genres.join(', ')}
        </Text>
      </Cell>
      <Cell width={COLUMNS[7]!.width}>
        <Text className={cellText} numberOfLines={1}>
          {row.developers.join(', ')}
        </Text>
      </Cell>
      <Cell width={COLUMNS[8]!.width} align="right">
        <Text className={cn(cellText, 'font-mono')} numberOfLines={1}>
          {fmtDate(row.ratedAt)}
        </Text>
      </Cell>
      <Cell width={COLUMNS[9]!.width} align="center">
        {row.reviewId ? (
          <Text
            accessibilityRole="link"
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: row.reviewId! } })}
            className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright underline"
          >
            Read
          </Text>
        ) : (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">—</Text>
        )}
      </Cell>
    </Pressable>
  );
}

export type RatingsSpreadsheetProps = {
  rows: readonly RatingsTableRow[];
  /** The owner and their friends can sort and filter; everyone else sees newest first. */
  canSortFilter: boolean;
  ownerName: string;
};

/**
 * Every game a player has rated, as a retro spreadsheet: click a column
 * header to sort (again to reverse), search + filter by tier, score range,
 * platform, genre and review. Wide tables scroll sideways on phones.
 */
export function RatingsSpreadsheet({ rows, canSortFilter, ownerName }: RatingsSpreadsheetProps) {
  const themeColors = useThemeColors();
  const [sort, setSort] = useState<TableSort>(DEFAULT_SORT);
  const [filters, setFilters] = useState<TableFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const active = canSortFilter ? filters : EMPTY_FILTERS;
  const shown = useMemo(() => applyTable(rows, active, canSortFilter ? sort : DEFAULT_SORT), [rows, active, sort, canSortFilter]);
  const filterCount = activeFilterCount(filters);

  return (
    <View className="flex-1 gap-2">
      {canSortFilter ? (
        <View className="gap-2">
          <View className="flex-row flex-wrap items-center gap-2">
            <TextInput
          style={noZoomInputStyle}
              value={filters.text}
              onChangeText={(text) => setFilters((f) => ({ ...f, text }))}
              placeholder="Search title, developer, genre…"
              placeholderTextColor={themeColors.textMuted}
              accessibilityLabel="Search ratings"
              className="retrogamingpc-input h-8 min-w-[200px] flex-1 outline-none"
            />
            <RetroGamingPCButton
              label={`Filters${filterCount > 0 ? ` (${filterCount})` : ''} ${showFilters ? '▴' : '▾'}`}
              onPress={() => setShowFilters((v) => !v)}
              accessibilityState={{ expanded: showFilters }}
            />
            {filterCount > 0 || sort !== DEFAULT_SORT ? (
              <RetroGamingPCButton
                variant="cancel"
                label="Reset"
                onPress={() => {
                  setFilters(EMPTY_FILTERS);
                  setSort(DEFAULT_SORT);
                }}
              />
            ) : null}
          </View>
          {showFilters ? <Filters rows={rows} filters={filters} onChange={setFilters} /> : null}
        </View>
      ) : (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          Newest first. {ownerName} and their friends can sort and filter this list.
        </Text>
      )}

      <Text className="retrogamingpc-label" accessibilityLiveRegion="polite">
        {shown.length === rows.length ? `${rows.length} game${rows.length === 1 ? '' : 's'}` : `${shown.length} of ${rows.length} games`}
        {canSortFilter ? ' · tap a column to sort' : ''}
      </Text>

      <ScrollView horizontal className="flex-1" contentContainerStyle={{ minWidth: '100%' }} showsHorizontalScrollIndicator>
        <View style={{ width: TABLE_WIDTH }} className="retrogamingpc-bevel-inset flex-1 bg-retrogamingpc-dark">
          <View className="flex-row border-b-2 border-b-retrogamingpc-accent bg-retrogamingpc-panel">
            {COLUMNS.map((c) => (
              <HeaderCell key={c.key} column={c} sort={sort} canSort={canSortFilter} onSort={(k) => setSort((s) => nextSort(s, k))} />
            ))}
          </View>
          <FlatList
            data={shown}
            keyExtractor={(r) => String(r.gameId)}
            renderItem={({ item, index }) => <Row row={item} index={index} />}
            getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            initialNumToRender={30}
            ListEmptyComponent={
              <View className="items-center p-4">
                <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">No games match these filters.</Text>
              </View>
            }
          />
        </View>
      </ScrollView>
    </View>
  );
}
