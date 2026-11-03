import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PcSpecsModal } from '@/components/profile/PcSpecsModal';
import { PlatformDevicesModal } from '@/components/profile/PlatformDevicesModal';
import { SystemSpecsPanel } from '@/components/profile/SystemSpecsPanel';
import {
  RetroGamingPCAlert,
  RetroGamingPCBadge,
  RetroGamingPCButton,
  RetroGamingPCCard,
  RetroGamingPCSpinner,
} from '@/components/ui';
import {
  PC_HANDHELD_SUGGESTIONS,
  PLATFORM_FAMILIES,
  PLATFORMS,
  platformIcon,
  platformInfo,
  type PlatformInfo,
} from '@/constants/platforms';
import { useAuthStore } from '@/hooks/useAuth';
import { usePlatformMutation, usePlatforms } from '@/hooks/useProfile';
import { useThemeColors } from '@/hooks/useTheme';
import type { UserPlatform } from '@/types/database.types';
import { cn } from '@/utils/cn';
import { EMPTY_PC_SPECS, parsePcSpecs, serializePcSpecs } from '@/utils/profileSchemas';

function PlatformChip({ platform, owned, onToggle }: { platform: PlatformInfo; owned: boolean; onToggle: () => void }) {
  const themeColors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: owned }}
      accessibilityLabel={platform.name}
      onPress={onToggle}
      className={cn(
        'flex-row items-center gap-1 border px-2 py-1',
        owned ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
      )}
    >
      <MaterialCommunityIcons name={platformIcon(platform)} size={11} color={owned ? themeColors.textBright : themeColors.textMuted} />
      <Text className={cn('text-retrogamingpc-xs', owned ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}>
        {platform.short}
      </Text>
    </Pressable>
  );
}

function OwnedPlatformCard({
  row,
  onSetMain,
  onEditSpecs,
  onEditDevices,
}: {
  row: UserPlatform;
  onSetMain: () => void;
  onEditSpecs: () => void;
  onEditDevices: () => void;
}) {
  const info = platformInfo(row.platform_id);
  const specs = parsePcSpecs(row.pc_specs);

  return (
    <RetroGamingPCCard selected={row.is_main} className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
          {info.name}
        </Text>
        {row.is_main ? <RetroGamingPCBadge label="Main Platform" variant="main" /> : null}
      </View>
      {info.hasDevices ? (
        row.devices.length > 0 ? (
          <View className="flex-row flex-wrap gap-1">
            {row.devices.map((name) => (
              <RetroGamingPCBadge key={name} label={name} variant="published" />
            ))}
          </View>
        ) : (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Which handhelds do you have? Add them below.</Text>
        )
      ) : null}
      {info.hasSpecs ? <SystemSpecsPanel title={info.short} specs={specs ?? EMPTY_PC_SPECS} /> : null}
      <View className="flex-row flex-wrap justify-end gap-2">
        {info.hasSpecs ? <RetroGamingPCButton label={specs ? 'Edit Specs' : 'Add Specs'} onPress={onEditSpecs} /> : null}
        {info.hasDevices ? (
          <RetroGamingPCButton label={row.devices.length > 0 ? 'Edit Devices' : 'Add Devices'} onPress={onEditDevices} />
        ) : null}
        {!row.is_main ? <RetroGamingPCButton label="Set as Main" variant="primary" onPress={onSetMain} /> : null}
      </View>
    </RetroGamingPCCard>
  );
}

/**
 * Settings → Hardware & Platforms: toggle owned platforms, move the Main badge,
 * edit PC spec sheets and handheld device lists. Profiles only display the
 * result (ProfilePlatforms in the profile header).
 */
export function PlatformSettings() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const platforms = usePlatforms(userId);
  const mutation = usePlatformMutation();
  const [specsFor, setSpecsFor] = useState<number | null>(null);
  const [devicesFor, setDevicesFor] = useState<number | null>(null);

  const rows = platforms.data ?? [];
  const owned = new Set(rows.map((r) => r.platform_id));
  const specsRow = specsFor !== null ? rows.find((r) => r.platform_id === specsFor) : undefined;
  const specsError = mutation.variables?.action === 'specs' && mutation.isError ? mutation.error.message : null;
  const devicesRow = devicesFor !== null ? rows.find((r) => r.platform_id === devicesFor) : undefined;
  const devicesError = mutation.variables?.action === 'devices' && mutation.isError ? mutation.error.message : null;

  if (platforms.isPending) return <RetroGamingPCSpinner label="Loading your hardware…" />;
  if (platforms.isError) return <RetroGamingPCAlert message={platforms.error.message} />;

  return (
    <View className="gap-3">
      {mutation.isError && !specsError && !devicesError ? <RetroGamingPCAlert message={mutation.error.message} /> : null}

      <View className="gap-2">
        <Text className="retrogamingpc-label">Owned platforms — tap to toggle</Text>
        {PLATFORM_FAMILIES.map((family) => (
          <View key={family.key} className="gap-1">
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">{family.label}</Text>
            <View className="flex-row flex-wrap gap-1">
              {PLATFORMS.filter((p) => p.family === family.key).map((platform) => (
                <PlatformChip
                  key={platform.id}
                  platform={platform}
                  owned={owned.has(platform.id)}
                  onToggle={() => mutation.mutate({ action: owned.has(platform.id) ? 'remove' : 'add', platformId: platform.id })}
                />
              ))}
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2 border-t border-t-retrogamingpc-accent pt-2">
        <Text className="retrogamingpc-label">Your setup ({rows.length})</Text>
        {rows.length === 0 ? (
          <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
            Nothing selected yet. Your platforms appear in your profile header.
          </Text>
        ) : (
          <View className="gap-2 md:flex-row md:flex-wrap">
            {rows.map((row) => (
              <View key={row.platform_id} className="md:w-[48%]">
                <OwnedPlatformCard
                  row={row}
                  onSetMain={() => mutation.mutate({ action: 'setMain', platformId: row.platform_id })}
                  onEditSpecs={() => setSpecsFor(row.platform_id)}
                  onEditDevices={() => setDevicesFor(row.platform_id)}
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <PlatformDevicesModal
        visible={devicesFor !== null}
        platformName={devicesFor !== null ? platformInfo(devicesFor).name : ''}
        initial={devicesRow?.devices ?? []}
        suggestions={PC_HANDHELD_SUGGESTIONS}
        saving={mutation.isPending && mutation.variables.action === 'devices'}
        error={devicesError}
        onClose={() => setDevicesFor(null)}
        onSave={(devices) => {
          if (devicesFor === null) return;
          mutation.mutate({ action: 'devices', platformId: devicesFor, devices }, { onSuccess: () => setDevicesFor(null) });
        }}
      />

      <PcSpecsModal
        visible={specsFor !== null}
        platformName={specsFor !== null ? platformInfo(specsFor).name : ''}
        initial={parsePcSpecs(specsRow?.pc_specs ?? null)}
        saving={mutation.isPending && mutation.variables.action === 'specs'}
        error={specsError}
        onClose={() => setSpecsFor(null)}
        onSave={(specs) => {
          if (specsFor === null) return;
          mutation.mutate(
            { action: 'specs', platformId: specsFor, pcSpecs: serializePcSpecs(specs) },
            { onSuccess: () => setSpecsFor(null) },
          );
        }}
      />
    </View>
  );
}
