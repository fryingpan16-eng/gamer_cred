import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';

import { RetroGamingPCTierBadge } from '@/components/ui';
import { ACTION_COLORS } from '@/constants/actionColors';
import {
  NOT_GOOD,
  NUMERIC_MAX,
  NUMERIC_MIN,
  PERFECT_TIER_GOLD,
  RATING_SCALE_LABELS,
  STARS_MAX,
  type RatingScale,
} from '@/constants/ratingRubric';
import { HERO_SCORE } from '@/constants/scoreBox';
import { usePrimaryRatingScale } from '@/hooks/useAuth';
import { useThemeColors } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';
import { noZoomInputStyle } from '@/utils/platform';
import {
  nextRatingForTap,
  parseNumericField,
  quickRatingDisplayOrder,
  quickRatingInScale,
  quickRatingKey,
  stepRating,
} from '@/utils/quickRating';
import {
  formatRounded,
  numericToTier,
  roundedToNumeric,
  tierDefinition,
  tierDefinitionForNumeric,
  toStoredRating,
  type RatingInput,
  type StoredRating,
  tierLabel,
  tierSpokenName,
} from '@/utils/rating';

export type QuickRatingProps = {
  gameId: number;
  /** The viewer's current rating (from a quick rating or their review — they are the same score). */
  value: StoredRating | null;
  onChange?: (value: StoredRating | null) => void;
  size?: 'compact' | 'regular' | 'hero';
  readOnly?: boolean;
  /** Defaults to the viewer's primary scale from Settings. */
  scale?: RatingScale;
  /** For screen readers: "Your rating for Hades". */
  gameName?: string;
  /** Show the tier badge beside the control (off where the tier is shown separately, e.g. the game page). */
  showTierBadge?: boolean;
  className?: string;
};

// Touch targets: compact (search rows) 30–32 × 36, regular (game page) 38–40 × 44.
const SIZES = {
  compact: { glyph: 22, cell: 30, chip: 32, height: 36, clear: 36 },
  regular: { glyph: 32, cell: 40, chip: 38, height: 44, clear: 44 },
  /** The game page's Your rating box: same headline size as the Gamer Cred score beside it. */
  hero: { glyph: HERO_SCORE.starGlyph, cell: HERO_SCORE.starCell, chip: 38, height: HERO_SCORE.rowHeight, clear: HERO_SCORE.rowHeight },
} as const;

type WebKeyEvent = { key: string; preventDefault: () => void };

function inputLabel(input: RatingInput): string {
  switch (input.scale) {
    case 'numeric':
      return `${input.value} out of ${NUMERIC_MAX}`;
    case 'stars':
      return `${input.value} of 5 stars`;
    case 'tier':
      return `Tier ${tierSpokenName(input.value)}, ${tierDefinition(input.value).descriptor}`;
    case 'rounded':
      return input.value === NOT_GOOD ? 'Not good' : `${input.value} out of 10`;
  }
}

const sameInput = (a: RatingInput | null, b: RatingInput) => a !== null && String(a.value) === String(b.value);

/** Tier-coloured chip (tier and rounded scales). */
function Chip({
  testID,
  color,
  textColor,
  selected,
  previewed,
  dimmed,
  width,
  height,
  onPress,
  children,
}: {
  testID: string;
  color: string;
  textColor: string;
  selected: boolean;
  previewed: boolean;
  dimmed: boolean;
  width: number;
  height: number;
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      testID={testID}
      // The row is one adjustable control for assistive tech; chips are touch / pointer targets.
      accessible={false}
      focusable={false}
      disabled={!onPress}
      onPress={onPress}
      style={{ minWidth: width, height }}
      className="items-center justify-center px-0.5"
    >
      <View
        className={cn('h-[80%] w-full items-center justify-center border px-1', selected || previewed ? 'border-2' : 'border')}
        style={{
          backgroundColor: color,
          opacity: dimmed && !selected && !previewed ? 0.45 : 1,
          borderColor: selected ? '#fafafa' : previewed ? '#b8b8b8' : 'rgba(0,0,0,0.35)',
        }}
      >
        <Text className="font-mono text-retrogamingpc-xs font-bold" style={{ color: textColor }} numberOfLines={1}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

/** 1–100: a number field (Enter / leaving the field sets it) plus −/+ one-tap steps. */
function NumericField({
  gameId,
  value,
  height,
  interactive,
  onCommit,
  label,
}: {
  gameId: number;
  value: StoredRating | null;
  height: number;
  interactive: boolean;
  onCommit: (value: StoredRating | null) => void;
  label: string;
}) {
  const themeColors = useThemeColors();
  const shown = quickRatingInScale(value, 'numeric');
  const current = shown ? Number(shown.value) : null;
  const [text, setText] = useState(current === null ? '' : String(current));
  // Re-sync the field when the saved value changes underneath it (other device, rollback).
  const [lastSeen, setLastSeen] = useState(current);
  if (current !== lastSeen) {
    setLastSeen(current);
    setText(current === null ? '' : String(current));
  }

  const submit = () => {
    const n = parseNumericField(text);
    if (n === null) {
      setText(current === null ? '' : String(current)); // invalid → back to the saved value
      return;
    }
    if (n !== current) onCommit(toStoredRating({ scale: 'numeric', value: n }));
  };
  const step = (delta: 1 | -1) => onCommit(toStoredRating(stepRating('numeric', shown, delta)));

  const stepButton = (delta: 1 | -1) => (
    <Pressable
      testID={`quick-rating-${gameId}-${delta > 0 ? 'up' : 'down'}`}
      accessibilityRole="button"
      accessibilityLabel={delta > 0 ? 'Increase by 1' : 'Decrease by 1'}
      onPress={() => step(delta)}
      style={{ width: height, height }}
      className="items-center justify-center"
    >
      <View className="retrogamingpc-bevel h-7 w-7 items-center justify-center bg-retrogamingpc-button">
        <Text className="font-bold text-retrogamingpc-text-bright">{delta > 0 ? '+' : '−'}</Text>
      </View>
    </Pressable>
  );

  if (!interactive) {
    return (
      <Text
        testID={`quick-rating-${gameId}`}
        accessibilityLabel={`${label}: ${current === null ? 'not rated' : `${current} out of 100`}`}
        className="font-mono text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright"
      >
        {current ?? '--'}
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted"> / {NUMERIC_MAX}</Text>
      </Text>
    );
  }

  return (
    <View className="flex-row items-center">
      {stepButton(-1)}
      <TextInput
        testID={`quick-rating-${gameId}`}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        onBlur={submit}
        keyboardType="number-pad"
        inputMode="numeric"
        returnKeyType="done"
        maxLength={3}
        selectTextOnFocus
        placeholder={`${NUMERIC_MIN}–${NUMERIC_MAX}`}
        placeholderTextColor={themeColors.textMuted}
        accessibilityLabel={`${label}, ${NUMERIC_MIN} to ${NUMERIC_MAX}`}
        accessibilityHint="Type a score and press Enter"
        style={{ ...noZoomInputStyle, height: height - 8 }}
        className="w-14 border border-b-retrogamingpc-bevel-light border-l-retrogamingpc-bevel-dark border-r-retrogamingpc-bevel-light border-t-retrogamingpc-bevel-dark bg-retrogamingpc-dark text-center font-mono text-retrogamingpc-lg font-bold text-retrogamingpc-text-bright outline-none"
      />
      {stepButton(1)}
      <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">/ {NUMERIC_MAX}</Text>
    </View>
  );
}

/**
 * One-tap rating in the viewer's chosen scale (Settings):
 *   stars — tap a half/full star · tier — tap a tier chip · rounded — tap 5–10 / NOT GOOD
 *   1–100 — type and press Enter, or −/+.
 * Tap the current value again, or ✕, to clear. Keyboard (web, chip scales):
 * arrows preview, Enter sets, Delete clears. It only ever reports a new score —
 * it never opens or creates a review.
 */
export function QuickRating({
  gameId,
  value,
  onChange,
  size = 'compact',
  readOnly = false,
  scale: scaleProp,
  gameName,
  showTierBadge = true,
  className,
}: QuickRatingProps) {
  const themeColors = useThemeColors();
  const primaryScale = usePrimaryRatingScale();
  const scale = scaleProp ?? primaryScale;
  const [preview, setPreview] = useState<RatingInput | null>(null);
  const dims = SIZES[size];
  const interactive = !readOnly && onChange !== undefined;
  const shown = quickRatingInScale(value, scale);
  const label = gameName ? `Your rating for ${gameName}` : 'Your rating';

  const commit = (next: StoredRating | null) => {
    setPreview(null);
    onChange?.(next);
  };

  const onKeyDown = (e: WebKeyEvent) => {
    const outcome = quickRatingKey(e.key, scale, value, preview);
    if (outcome.kind === 'ignore') return;
    e.preventDefault();
    if (outcome.kind === 'preview') setPreview(outcome.input);
    else if (outcome.kind === 'reset') setPreview(null);
    else commit(outcome.value);
  };
  // react-native-web forwards tabIndex/onKeyDown to the DOM node; native ignores them.
  const webKeyboard = interactive && Platform.OS === 'web' ? { tabIndex: 0, onKeyDown } : {};

  const clearButton =
    interactive && value ? (
      <Pressable
        testID={`quick-rating-${gameId}-clear`}
        accessibilityRole="button"
        accessibilityLabel={gameName ? `Clear your rating for ${gameName}` : 'Clear your rating'}
        onPress={() => commit(null)}
        style={{ width: dims.clear, height: dims.clear }}
        className="items-center justify-center"
      >
        <Text className="font-mono text-retrogamingpc-sm font-bold" style={{ color: ACTION_COLORS.cancel.text }}>
          ✕
        </Text>
      </Pressable>
    ) : null;

  const tierBadge =
    value && showTierBadge ? (
      <RetroGamingPCTierBadge tier={numericToTier(value.numeric)} showDescriptor={size !== 'compact'} size="compact" />
    ) : null;

  if (scale === 'numeric') {
    return (
      <View className={cn('flex-row flex-wrap items-center gap-1', className)}>
        <NumericField
          // Remount (fresh text) when the game changes.
          key={gameId}
          gameId={gameId}
          value={value}
          height={dims.height}
          interactive={interactive}
          onCommit={commit}
          label={label}
        />
        {tierBadge}
        {clearButton}
      </View>
    );
  }

  const options = quickRatingDisplayOrder(scale);
  const highlighted = preview ?? shown;

  const control =
    scale === 'stars'
      ? Array.from({ length: 5 }, (_, i) => {
          const starsShown = highlighted ? Number(highlighted.value) : 0;
          const fill = starsShown - i; // ≥1 full, 0.5 half, ≤0 empty
          // A full 5/5 shines gold, like the perfect-score S.
          const filledColor = starsShown >= STARS_MAX ? PERFECT_TIER_GOLD : themeColors.highlight;
          const icon = fill >= 1 ? 'star' : fill >= 0.5 ? 'star-half-full' : 'star-outline';
          return (
            <View key={i} style={{ width: dims.cell, height: dims.height }} className="items-center justify-center">
              <MaterialCommunityIcons name={icon} size={dims.glyph} color={fill > 0 ? filledColor : themeColors.accent} />
              {interactive ? (
                <View className="absolute inset-0 flex-row">
                  {([i + 0.5, i + 1] as const).map((half) => {
                    const input: RatingInput = { scale: 'stars', value: half };
                    return (
                      <Pressable
                        key={half}
                        testID={`quick-rating-${gameId}-${half}`}
                        accessible={false}
                        focusable={false}
                        className="flex-1"
                        onPress={() => commit(nextRatingForTap(value, input))}
                        onHoverIn={() => setPreview(input)}
                        onHoverOut={() => setPreview(null)}
                      />
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      : options.map((input) => {
          const def =
            input.scale === 'tier'
              ? tierDefinition(input.value)
              : tierDefinitionForNumeric(roundedToNumeric(input.scale === 'rounded' ? input.value : NOT_GOOD));
          const text =
            input.scale === 'rounded' && input.value === NOT_GOOD
              ? size === 'compact'
                ? 'NG'
                : NOT_GOOD
              : input.scale === 'tier'
                ? tierLabel(input.value)
                : String(input.value);
          return (
            <Chip
              key={String(input.value)}
              testID={`quick-rating-${gameId}-${String(input.value)}`}
              color={def.color}
              textColor={def.textColor}
              selected={sameInput(shown, input)}
              previewed={sameInput(preview, input)}
              dimmed={shown !== null || preview !== null}
              width={dims.chip}
              height={dims.height}
              onPress={interactive ? () => commit(nextRatingForTap(value, input)) : undefined}
            >
              {text}
            </Chip>
          );
        });

  return (
    <View className={cn('flex-row flex-wrap items-center gap-1', className)}>
      <View
        {...(webKeyboard as object)}
        testID={`quick-rating-${gameId}`}
        accessible
        accessibilityRole={interactive ? 'adjustable' : 'image'}
        accessibilityLabel={`${label} (${RATING_SCALE_LABELS[scale]})`}
        accessibilityValue={{ text: shown === null ? 'Not rated' : inputLabel(shown) }}
        accessibilityHint={interactive ? 'Swipe up or down to change. Arrow keys and Enter on a keyboard.' : undefined}
        accessibilityActions={interactive ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
        onAccessibilityAction={(e) => {
          if (!interactive) return;
          const delta = e.nativeEvent.actionName === 'increment' ? 1 : -1;
          commit(toStoredRating(stepRating(scale, shown, delta)));
        }}
        className="flex-row flex-wrap"
      >
        {control}
      </View>
      {scale === 'stars' && size === 'hero' ? (
        // Headline value, styled like the Gamer Cred score's.
        <Text
          className={cn(HERO_SCORE.valueClass, value ? 'text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}
          style={shown && Number(shown.value) >= STARS_MAX ? { color: PERFECT_TIER_GOLD } : undefined}
        >
          {shown ? `${shown.value}★` : '--'}
        </Text>
      ) : scale === 'tier' ? (
        size !== 'compact' && value ? (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text">{tierDefinitionForNumeric(value.numeric).descriptor}</Text>
        ) : null
      ) : scale === 'rounded' ? (
        value ? (
          <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-bright">
            {shown ? formatRounded(shown.scale === 'rounded' ? shown.value : NOT_GOOD) : ''}
          </Text>
        ) : null
      ) : value ? (
        tierBadge
      ) : (
        <Text className="font-mono text-retrogamingpc-xs text-retrogamingpc-text-muted">{interactive ? 'Rate' : '--'}</Text>
      )}
      {scale === 'rounded' ? tierBadge : null}
      {clearButton}
    </View>
  );
}
