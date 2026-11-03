import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RetroGamingPCBadge, RetroGamingPCButton, RetroGamingPCModal } from '@/components/ui';
import { groupByFamily, platformIcon, platformInfo } from '@/constants/platforms';
import { usePlatforms } from '@/hooks/useProfile';
import { useThemeColors } from '@/hooks/useTheme';
import type { UserPlatform } from '@/types/database.types';
import { cn } from '@/utils/cn';
import { parsePcSpecs } from '@/utils/profileSchemas';

import { SystemSpecsPanel } from './SystemSpecsPanel';

/** A chip has details to show when it's a computer with specs or a handheld with devices. */
function hasDetails(row: UserPlatform): boolean {
  const info = platformInfo(row.platform_id);
  return Boolean((info.hasSpecs && parsePcSpecs(row.pc_specs)) || (info.hasDevices && row.devices.length > 0));
}

function PlatformChip({ row, onPress }: { row: UserPlatform; onPress?: () => void }) {
  const themeColors = useThemeColors();
  const info = platformInfo(row.platform_id);
  const label = info.hasDevices && row.devices.length === 1 ? row.devices[0]! : info.short;

  const body = (
    <View
      className={cn(
        'flex-row items-center gap-1 border px-1.5 py-0.5',
        row.is_main ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
      )}
    >
      <MaterialCommunityIcons name={platformIcon(info)} size={11} color={row.is_main ? themeColors.textBright : themeColors.text} />
      <Text className={cn('text-retrogamingpc-xs', row.is_main ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text')}>
        {row.is_main ? '★ ' : ''}
        {label}
      </Text>
      {onPress ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">▸</Text> : null}
    </View>
  );

  if (!onPress) {
    return <View accessibilityLabel={`${info.name}${row.is_main ? ', main platform' : ''}`}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${info.name}${row.is_main ? ', main platform' : ''}`}
      accessibilityHint={info.hasSpecs ? 'Shows PC specs' : 'Shows devices'}
      onPress={onPress}
      hitSlop={4}
    >
      {body}
    </Pressable>
  );
}

/** Read-only details for one platform: a PC spec sheet or a handheld device list. */
function PlatformDetailModal({ row, onClose }: { row: UserPlatform | null; onClose: () => void }) {
  const info = row ? platformInfo(row.platform_id) : null;
  const specs = row ? parsePcSpecs(row.pc_specs) : null;

  return (
    <RetroGamingPCModal
      visible={row !== null}
      title={info ? info.name : ''}
      onClose={onClose}
      footer={<RetroGamingPCButton variant="cancel" label="Close" onPress={onClose} />}
    >
      {row && info ? (
        <View className="gap-2">
          {row.is_main ? <RetroGamingPCBadge label="Main Platform" variant="main" /> : null}
          {info.hasSpecs && specs ? <SystemSpecsPanel title={info.short} specs={specs} /> : null}
          {info.hasDevices && row.devices.length > 0 ? (
            <View className="gap-1">
              <Text className="retrogamingpc-label">Devices</Text>
              <View className="flex-row flex-wrap gap-1">
                {row.devices.map((name) => (
                  <RetroGamingPCBadge key={name} label={name} variant="published" />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </RetroGamingPCModal>
  );
}

/**
 * The player's owned platforms as compact chips, one row per maker (Main marked ★).
 * PC / Mac / Linux chips with specs and PC Handheld chips with devices open a
 * read-only detail popup. Editing lives in Settings → Hardware & Platforms.
 */
export function ProfilePlatforms({ userId, isOwner }: { userId: string; isOwner: boolean }) {
  const platforms = usePlatforms(userId);
  const [open, setOpen] = useState<UserPlatform | null>(null);
  const rows = platforms.data ?? [];

  if (platforms.isPending || platforms.isError) return null;

  if (rows.length === 0) {
    return isOwner ? (
      <Link href="/settings" className="text-retrogamingpc-xs text-retrogamingpc-text-bright underline">
        + Add your platforms in Settings
      </Link>
    ) : null;
  }

  return (
    <>
      {/* One row per maker: label on the left, that maker's chips wrapping beside it. */}
      <View className="gap-1" accessibilityLabel="Platforms">
        {groupByFamily(rows).map((group) => (
          <View key={group.key} className="flex-row items-start gap-2" accessibilityLabel={group.label}>
            <Text className="w-[76px] pt-0.5 text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={1}>
              {group.short}
            </Text>
            <View className="flex-1 flex-row flex-wrap gap-1">
              {group.rows.map((row) => (
                <PlatformChip key={row.platform_id} row={row} onPress={hasDetails(row) ? () => setOpen(row) : undefined} />
              ))}
            </View>
          </View>
        ))}
      </View>
      <PlatformDetailModal row={open} onClose={() => setOpen(null)} />
    </>
  );
}
