/**
 * Pure helpers that turn the Postgres stats aggregates (migration 000014) into
 * chart data. Counting happens in SQL; these only reshape small results
 * (≤ 100 histogram rows, ~decades, months) and derive the other rating scales
 * with the one rubric (src/constants/ratingRubric.ts).
 */
import { platformInfo } from '@/constants/platforms';
import {
  NOT_GOOD,
  NUMERIC_MAX,
  NUMERIC_MIN,
  RATING_SCALE_LABELS,
  RATING_TIERS,
  ROUNDED_VALUES,
  STARS_MAX,
  STARS_MIN,
  STARS_STEP,
  type RatingScale,
  type TierCode,
} from '@/constants/ratingRubric';

import {
  deriveAllScales,
  formatRounded,
  formatStars,
  numericToRounded,
  numericToStars,
  numericToTier,
  roundedToNumeric,
  starsToNumeric,
  tierDefinitionForNumeric,
} from './rating';

export const UNKNOWN_LABEL = 'Unknown';

export type BarDatum = {
  /** Stable key. */
  key: string;
  label: string;
  value: number;
  /** Shown in the tooltip / screen-reader table next to the value. */
  detail?: string;
  /** Optional bar colour (e.g. the tier colour); defaults to the theme highlight. */
  color?: string;
  /**
   * With `color`: draw the label as a tier-list chip (label on `color`, in this
   * text colour) instead of plain text.
   */
  labelTextColor?: string;
};

export type HistogramRow = { score: number; games: number };

/**
 * Tier-list colours for a 1–100 score. Every chart of ratings uses these, so a
 * bar is always the colour of the tier its rating falls in.
 */
export function tierColors(numeric: number): Pick<BarDatum, 'color' | 'labelTextColor'> {
  const def = tierDefinitionForNumeric(Math.min(NUMERIC_MAX, Math.max(NUMERIC_MIN, Math.round(numeric))));
  return { color: def.color, labelTextColor: def.textColor };
}

// -----------------------------------------------------------------------------
// Ratings
// -----------------------------------------------------------------------------

export type RatingSummary = {
  count: number;
  /** Mean of the canonical 1–100 scores (null when nothing is rated). */
  averageNumeric: number | null;
  medianNumeric: number | null;
};

export function summarizeHistogram(rows: readonly HistogramRow[]): RatingSummary {
  const valid = rows.filter((r) => r.score >= NUMERIC_MIN && r.score <= NUMERIC_MAX && r.games > 0);
  const count = valid.reduce((n, r) => n + r.games, 0);
  if (count === 0) return { count: 0, averageNumeric: null, medianNumeric: null };
  const sum = valid.reduce((n, r) => n + r.score * r.games, 0);
  // Median from the sorted histogram without expanding it.
  const sorted = [...valid].sort((a, b) => a.score - b.score);
  const midLow = Math.floor((count - 1) / 2);
  const midHigh = Math.floor(count / 2);
  let seen = 0;
  let low: number | null = null;
  let high: number | null = null;
  for (const r of sorted) {
    const next = seen + r.games;
    if (low === null && midLow < next) low = r.score;
    if (high === null && midHigh < next) high = r.score;
    seen = next;
  }
  return { count, averageNumeric: Math.round((sum / count) * 10) / 10, medianNumeric: ((low ?? 0) + (high ?? 0)) / 2 };
}

/** One distribution + average for each of the four display scales. */
export type ScaleDistribution = {
  scale: RatingScale;
  title: string;
  /** Average expressed in this scale ("78.4", "B", "3.9/5", "8/10"). */
  averageLabel: string | null;
  bars: BarDatum[];
  /**
   * How the chart is drawn: 'horizontal' = rows top → bottom, best first, bars
   * growing left → right (1–100, tier); 'vertical' = columns worst → best.
   */
  orientation: 'horizontal' | 'vertical';
};

export function distributionsByScale(rows: readonly HistogramRow[]): ScaleDistribution[] {
  const { averageNumeric } = summarizeHistogram(rows);
  const avgRounded = averageNumeric === null ? null : Math.min(NUMERIC_MAX, Math.max(NUMERIC_MIN, Math.round(averageNumeric)));
  const valid = rows.filter((r) => r.score >= NUMERIC_MIN && r.score <= NUMERIC_MAX && r.games > 0);
  const count = valid.reduce((n, r) => n + r.games, 0);

  // Numeric: every score 1–100 as its own row, 100 at the top.
  const numericCounts = new Map<number, number>(valid.map((r) => [r.score, r.games]));
  const numericBars: BarDatum[] = [];
  for (let score = NUMERIC_MAX; score >= NUMERIC_MIN; score--) {
    numericBars.push({ key: `n${score}`, label: String(score), value: numericCounts.get(score) ?? 0, detail: `tier ${numericToTier(score)}`, ...tierColors(score) });
  }

  // Tier: a tier list, best (S**) at the top, in the rubric colours.
  const tierCounts = new Map<TierCode, number>(RATING_TIERS.map((t) => [t.tier, 0]));
  for (const r of valid) tierCounts.set(numericToTier(r.score), (tierCounts.get(numericToTier(r.score)) ?? 0) + r.games);
  const tierBars: BarDatum[] = RATING_TIERS.map((t) => ({
    key: `t${t.tier}`,
    label: t.label,
    value: tierCounts.get(t.tier) ?? 0,
    detail: t.descriptor,
    color: t.color,
    labelTextColor: t.textColor,
  }));

  // Stars: every half step.
  const starValues: number[] = [];
  for (let s = STARS_MIN; s <= STARS_MAX; s += STARS_STEP) starValues.push(s);
  const starCounts = new Map<number, number>(starValues.map((s) => [s, 0]));
  let starSum = 0;
  for (const r of valid) {
    const stars = numericToStars(r.score);
    starCounts.set(stars, (starCounts.get(stars) ?? 0) + r.games);
    starSum += stars * r.games;
  }
  // Each star value takes the colour of the tier it converts to (5★ → S, 4.5★ → A+, ≤ 2★ → F).
  const starBars: BarDatum[] = starValues.map((s) => ({ key: `s${s}`, label: formatStars(s), value: starCounts.get(s) ?? 0, ...tierColors(starsToNumeric(s)) }));

  // Rounded: NOT GOOD, 5 … 10.
  const roundedOrder = [...ROUNDED_VALUES].reverse();
  const roundedCounts = new Map<string, number>(roundedOrder.map((v) => [String(v), 0]));
  for (const r of valid) {
    const v = String(numericToRounded(r.score));
    roundedCounts.set(v, (roundedCounts.get(v) ?? 0) + r.games);
  }
  const roundedBars: BarDatum[] = roundedOrder.map((v) => ({
    key: `r${v}`,
    label: v === NOT_GOOD ? 'NOT GOOD' : String(v),
    value: roundedCounts.get(String(v)) ?? 0,
    ...tierColors(roundedToNumeric(v)),
  }));

  return [
    { scale: 'numeric', title: RATING_SCALE_LABELS.numeric, averageLabel: averageNumeric === null ? null : averageNumeric.toFixed(1), bars: numericBars, orientation: 'horizontal' },
    {
      scale: 'tier',
      title: RATING_SCALE_LABELS.tier,
      averageLabel: avgRounded === null ? null : `${numericToTier(avgRounded)} · ${deriveAllScales(avgRounded).descriptor}`,
      bars: tierBars,
      orientation: 'horizontal',
    },
    {
      scale: 'stars',
      title: RATING_SCALE_LABELS.stars,
      averageLabel: count === 0 ? null : `${(Math.round((starSum / count) * 10) / 10).toFixed(1)}/5`,
      bars: starBars,
      orientation: 'vertical',
    },
    { scale: 'rounded', title: RATING_SCALE_LABELS.rounded, averageLabel: avgRounded === null ? null : formatRounded(numericToRounded(avgRounded)), bars: roundedBars, orientation: 'vertical' },
  ];
}

export type RatingTendency = 'harsh' | 'balanced' | 'generous';

/** Harsh / generous from the average score (tier A starts at 80; C/D/F at ≤ 69). */
export function ratingTendency(averageNumeric: number | null): RatingTendency | null {
  if (averageNumeric === null) return null;
  if (averageNumeric >= 80) return 'generous';
  if (averageNumeric < 65) return 'harsh';
  return 'balanced';
}

// -----------------------------------------------------------------------------
// Buckets
// -----------------------------------------------------------------------------

/** Unknown always sorts last regardless of size. */
function unknownLast(bars: BarDatum[]): BarDatum[] {
  return [...bars.filter((b) => b.label !== UNKNOWN_LABEL), ...bars.filter((b) => b.label === UNKNOWN_LABEL)];
}

export function platformBars(rows: readonly { platform_id: number | null; games: number }[]): BarDatum[] {
  return unknownLast(
    rows
      .filter((r) => r.games > 0)
      .map((r) => ({
        key: `p${r.platform_id ?? 'unknown'}`,
        label: r.platform_id === null ? UNKNOWN_LABEL : platformInfo(Number(r.platform_id)).name,
        value: r.games,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );
}

export function nameCountBars(rows: readonly { name: string; games: number }[], prefix: string): BarDatum[] {
  return unknownLast(
    rows
      .filter((r) => r.games > 0)
      .map((r) => ({ key: `${prefix}${r.name}`, label: r.name, value: r.games }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );
}

export function genreAverageBars(rows: readonly { genre: string; rated_games: number; average_rating: number | null }[]): BarDatum[] {
  return unknownLast(
    rows
      .filter((r) => r.average_rating !== null && r.rated_games > 0)
      .map((r) => ({
        key: `ga${r.genre}`,
        label: r.genre,
        value: Math.round(Number(r.average_rating) * 10) / 10,
        detail: `${numericToTier(Math.min(100, Math.max(1, Math.round(Number(r.average_rating)))))} · ${r.rated_games} rated`,
        // Bar in the tier colour of the average; the label stays the plain genre name.
        color: tierColors(Number(r.average_rating)).color,
      }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  );
}

export type EraGranularity = 'decade' | 'year';

export function eraBars(rows: readonly { release_year: number | null; games: number }[], granularity: EraGranularity): BarDatum[] {
  const counts = new Map<string, { sort: number; value: number }>();
  for (const r of rows) {
    if (r.games <= 0) continue;
    const year = r.release_year === null ? null : Number(r.release_year);
    const label = year === null ? UNKNOWN_LABEL : granularity === 'decade' ? `${Math.floor(year / 10) * 10}s` : String(year);
    const sort = year === null ? Number.MAX_SAFE_INTEGER : granularity === 'decade' ? Math.floor(year / 10) * 10 : year;
    const prev = counts.get(label) ?? { sort, value: 0 };
    counts.set(label, { sort, value: prev.value + r.games });
  }
  return [...counts]
    .sort(([, a], [, b]) => a.sort - b.sort)
    .map(([label, { value }]) => ({ key: `e${label}`, label, value }));
}

export type TimelineGranularity = 'month' | 'year';

/** Continuous timeline: months (or years) with no logs show as zero. */
export function timelineBars(rows: readonly { month: string; games: number }[], granularity: TimelineGranularity): BarDatum[] {
  if (rows.length === 0) return [];
  const byMonth = new Map<string, number>();
  for (const r of rows) byMonth.set(r.month.slice(0, 7), (byMonth.get(r.month.slice(0, 7)) ?? 0) + r.games);
  const keys = [...byMonth.keys()].sort();
  const [startY, startM] = keys[0]!.split('-').map(Number) as [number, number];
  const [endY, endM] = keys[keys.length - 1]!.split('-').map(Number) as [number, number];

  if (granularity === 'year') {
    const bars: BarDatum[] = [];
    for (let y = startY; y <= endY; y++) {
      const value = [...byMonth].filter(([k]) => k.startsWith(`${y}-`)).reduce((n, [, v]) => n + v, 0);
      bars.push({ key: `y${y}`, label: String(y), value });
    }
    return bars;
  }

  const bars: BarDatum[] = [];
  let y = startY;
  let m = startM;
  while (y < endY || (y === endY && m <= endM)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    bars.push({
      key: `m${key}`,
      label: new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      value: byMonth.get(key) ?? 0,
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return bars;
}

// -----------------------------------------------------------------------------
// Gamer profile summary (client-side text, no AI)
// -----------------------------------------------------------------------------

export type SummaryInputs = {
  histogram: readonly HistogramRow[];
  platforms: readonly BarDatum[];
  genres: readonly BarDatum[];
  genreAverages: readonly BarDatum[];
  decades: readonly BarDatum[];
  studios: readonly BarDatum[];
  /** Your most replayed game (migration 000040), if you've replayed anything. */
  mostReplayed?: { name: string; plays: number } | null;
};

const known = (bars: readonly BarDatum[]) => bars.filter((b) => b.label !== UNKNOWN_LABEL && b.value > 0);
const top = (bars: readonly BarDatum[]) => [...known(bars)].sort((a, b) => b.value - a.value)[0];

/** A few short sentences describing the player. Empty when nothing is logged. */
export function gamerProfileSummary(input: SummaryInputs): string[] {
  const lines: string[] = [];
  const topPlatform = top(input.platforms);
  const topGenre = top(input.genres);
  const topEra = top(input.decades);
  const topStudio = top(input.studios);
  const { count, averageNumeric } = summarizeHistogram(input.histogram);

  if (topPlatform) lines.push(`Your home turf is ${topPlatform.label}, with ${topPlatform.value} game${topPlatform.value === 1 ? '' : 's'} logged there.`);
  if (topGenre) lines.push(`You gravitate toward ${topGenre.label} games.`);
  if (topEra) lines.push(`Your favorite era is the ${topEra.label}.`);
  if (topStudio) lines.push(`The studio you play most is ${topStudio.label}.`);
  if (input.mostReplayed && input.mostReplayed.plays > 1)
    lines.push(`You keep coming back to ${input.mostReplayed.name} (${input.mostReplayed.plays} plays).`);

  if (count > 0 && averageNumeric !== null) {
    const tendency = ratingTendency(averageNumeric);
    const avgTier = numericToTier(Math.min(100, Math.max(1, Math.round(averageNumeric))));
    lines.push(
      `Across ${count} rating${count === 1 ? '' : 's'} you average ${averageNumeric.toFixed(1)} (tier ${avgTier}) — ${
        tendency === 'generous' ? 'a generous critic' : tendency === 'harsh' ? 'a tough critic' : 'a balanced critic'
      }.`,
    );
    // Most common tier, plus the genres you score highest / lowest.
    const tiers = distributionsByScale(input.histogram).find((d) => d.scale === 'tier')!.bars;
    // Ties go to the better tier (tiers are listed best → worst; sort is stable).
    const commonTier = [...tiers].sort((a, b) => b.value - a.value)[0];
    if (commonTier && commonTier.value > 0) lines.push(`Your most common verdict is ${commonTier.label} (${commonTier.detail}).`);
    const rated = known(input.genreAverages);
    if (rated.length >= 2) {
      const best = rated[0]!;
      const worst = rated[rated.length - 1]!;
      lines.push(`You score ${best.label} highest (avg ${best.value}) and ${worst.label} lowest (avg ${worst.value}).`);
    }
  }
  return lines;
}

/** Replays per year (migration 000040), oldest year first. */
export function replayYearBars(rows: readonly { year: number; replays: number }[]): BarDatum[] {
  return [...rows]
    .sort((a, b) => a.year - b.year)
    .map((r) => ({ key: String(r.year), label: String(r.year), value: r.replays, detail: `${r.replays} replay${r.replays === 1 ? '' : 's'}` }));
}
