import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PlatformPicker } from '@/components/studio/PlatformPicker';
import { platformIcon, platformInfo } from '@/constants/platforms';
import { useThemeColors } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

export type PlayedOnControlProps = {
  gameId: number;
  /** Effective platform (saved, picked, or the earliest-release default). */
  platformId: number | null;
  /** True when it is the earliest-release default rather than the user's pick. */
  isDefault: boolean;
  defaultPlatformId: number | null;
  onChange: (platformId: number) => void;
  compact?: boolean;
  disabled?: boolean;
};

/**
 * "Played on: PS2 ▸" for a quick rating. Tap to open an inline platform picker
 * (your platforms first, every catalog platform one tap away) — no modal, no
 * navigation. Defaults to the game's earliest release platform.
 */
export function PlayedOnControl({ gameId, platformId, isDefault, defaultPlatformId, onChange, compact = false, disabled = false }: PlayedOnControlProps) {
  const themeColors = useThemeColors();
  const [open, setOpen] = useState(false);
  const info = platformId !== null ? platformInfo(platformId) : null;
  const name = info ? (compact ? info.short : info.name) : 'Choose platform';

  return (
    <View className="gap-1.5">
      <Pressable
        testID={`played-on-${gameId}`}
        accessibilityRole="button"
        accessibilityLabel={`Played on ${info ? info.name : 'not set'}${isDefault && info ? ', earliest release' : ''}. Change platform`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => setOpen((v) => !v)}
        hitSlop={6}
        className={cn('flex-row items-center gap-1 self-start', compact ? 'min-h-[28px]' : 'min-h-[32px]', disabled && 'opacity-50')}
      >
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Played on</Text>
        {info ? <MaterialCommunityIcons name={platformIcon(info)} size={compact ? 11 : 13} color={themeColors.textBright} /> : null}
        <Text className={cn('font-bold text-retrogamingpc-text-bright underline', compact ? 'text-retrogamingpc-xs' : 'text-retrogamingpc-sm')}>{name}</Text>
        {isDefault && info ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">(earliest)</Text> : null}
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{open ? '▾' : '▸'}</Text>
      </Pressable>
      {open ? (
        <PlatformPicker
          compact={compact}
          allowNone={false}
          defaultId={defaultPlatformId}
          value={platformId}
          onChange={(id) => {
            if (id === null) return;
            onChange(id);
            setOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}
