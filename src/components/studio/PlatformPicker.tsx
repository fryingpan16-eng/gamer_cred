import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PLATFORM_FAMILIES, PLATFORMS, platformIcon, platformInfo, type PlatformInfo } from '@/constants/platforms';
import { useAuthStore } from '@/hooks/useAuth';
import { usePlatforms } from '@/hooks/useProfile';
import { useThemeColors } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

type PlatformPickerProps = {
  /** Selected catalog id, or null for "not specified". */
  value: number | null;
  onChange: (platformId: number | null) => void;
  label?: string;
  error?: string;
  /** Offer a "Not specified" chip (reviews). Quick ratings always have a platform. Default true. */
  allowNone?: boolean;
  /** Platform to mark "(earliest release)" — the default when nothing is picked. */
  defaultId?: number | null;
  /** Smaller, label-less variant for search rows. */
  compact?: boolean;
};

function Chip({
  platform,
  selected,
  onPress,
  isDefault = false,
}: {
  platform: PlatformInfo | null;
  selected: boolean;
  onPress: () => void;
  isDefault?: boolean;
}) {
  const themeColors = useThemeColors();
  const name = platform ? `${platform.short}${isDefault ? ' (earliest)' : ''}` : 'Not specified';
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={platform ? platform.name : 'Platform not specified'}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-1 border px-2 py-1',
        selected ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
      )}
    >
      {platform ? (
        <MaterialCommunityIcons name={platformIcon(platform)} size={11} color={selected ? themeColors.textBright : themeColors.textMuted} />
      ) : null}
      <Text className={cn('text-retrogamingpc-xs', selected ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}>
        {name}
      </Text>
    </Pressable>
  );
}

/**
 * "Played on" picker: your own platforms first (Main first), with every other
 * catalog platform one tap away. Only catalog ids can be chosen.
 */
export function PlatformPicker({ value, onChange, label = 'Played on', error, allowNone = true, defaultId = null, compact = false }: PlatformPickerProps) {
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const roster = usePlatforms(viewerId);
  const rosterPlatforms = (roster.data ?? []).map((r) => platformInfo(r.platform_id));
  // The game's earliest platform sits with your own, so the default is one tap away.
  const owned = defaultId !== null && !rosterPlatforms.some((p) => p.id === defaultId) ? [platformInfo(defaultId), ...rosterPlatforms] : rosterPlatforms;
  const ownedIds = new Set(owned.map((p) => p.id));
  // Show the full catalog when you own nothing, or when the current pick isn't one of yours.
  const [showAll, setShowAll] = useState(false);
  const expanded = showAll || owned.length === 0 || (value !== null && !ownedIds.has(value));

  return (
    <View className="gap-1.5">
      {compact ? null : <Text className={cn('retrogamingpc-label', error && 'text-retrogamingpc-error')}>{label}</Text>}
      <View className="flex-row flex-wrap gap-1" accessibilityRole="radiogroup">
        {owned.map((p) => (
          <Chip key={p.id} platform={p} selected={value === p.id} isDefault={p.id === defaultId} onPress={() => onChange(p.id)} />
        ))}
        {allowNone ? <Chip platform={null} selected={value === null} onPress={() => onChange(null)} /> : null}
        {owned.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setShowAll((v) => !v)} className="justify-center px-1">
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">
              {expanded ? 'Hide other platforms' : 'Other platform…'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {expanded ? (
        <View className="gap-1 border-l-2 border-l-retrogamingpc-accent pl-2">
          {PLATFORM_FAMILIES.map((family) => {
            const options = PLATFORMS.filter((p) => p.family === family.key && !ownedIds.has(p.id));
            if (options.length === 0) return null;
            return (
              <View key={family.key} className="gap-1">
                <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{family.label}</Text>
                <View className="flex-row flex-wrap gap-1">
                  {options.map((p) => (
                    <Chip key={p.id} platform={p} selected={value === p.id} isDefault={p.id === defaultId} onPress={() => onChange(p.id)} />
                  ))}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
      {error ? <Text className="text-retrogamingpc-xs text-retrogamingpc-error">▲ {error}</Text> : null}
    </View>
  );
}
