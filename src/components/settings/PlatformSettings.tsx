import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { PcSpecsModal } from '@/components/profile/PcSpecsModal';
import { PlatformDevicesModal } from '@/components/profile/PlatformDevicesModal';
import {
  RetroGamingPCAlert,
  RetroGamingPCButton,
  RetroGamingPCConfirmModal,
  RetroGamingPCModal,
  RetroGamingPCSaveStatus,
  RetroGamingPCSpinner,
  saveStatusOf,
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
import { pcSpecsSummary } from '@/utils/platformSummary';
import { parsePcSpecs, serializePcSpecs } from '@/utils/profileSchemas';

function PlatformChip({
  platform,
  owned,
  main,
  onToggle,
}: {
  platform: PlatformInfo;
  owned: boolean;
  main: boolean;
  onToggle: () => void;
}) {
  const themeColors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: owned }}
      accessibilityLabel={main ? `${platform.name}, main platform` : platform.name}
      onPress={onToggle}
      hitSlop={4}
      className={cn(
        'min-h-[30px] flex-row items-center gap-1 border px-2 py-1',
        owned ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
      )}
    >
      <MaterialCommunityIcons
        name={main ? 'star' : platformIcon(platform)}
        size={12}
        color={owned ? themeColors.textBright : themeColors.textMuted}
      />
      <Text className={cn('text-retrogamingpc-xs', owned ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}>
        {platform.short}
      </Text>
    </Pressable>
  );
}

/** Under the PC chips: one line per owned computer / handheld entry, with its edit button. */
function DetailLine({ row, onEdit }: { row: UserPlatform; onEdit: () => void }) {
  const info = platformInfo(row.platform_id);
  const summary = info.hasSpecs ? pcSpecsSummary(parsePcSpecs(row.pc_specs)) : row.devices.join(', ');
  const empty = summary.length === 0;
  return (
    <View className="flex-row items-center gap-2">
      <Text className="flex-1 text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={2}>
        <Text className="font-bold text-retrogamingpc-text">{info.short}: </Text>
        {empty ? (info.hasSpecs ? 'no specs yet' : 'no devices yet') : summary}
      </Text>
      <RetroGamingPCButton
        label={info.hasSpecs ? (empty ? 'Add Specs' : 'Edit Specs') : empty ? 'Add Devices' : 'Edit Devices'}
        onPress={onEdit}
      />
    </View>
  );
}

/**
 * Settings → Hardware & Platforms: toggle chips grouped by maker, a single Main button
 * (opens a list of what you own), and spec / device lines under the PC group.
 * Profiles only display the result (ProfilePlatforms in the profile header).
 */
export function PlatformSettings() {
  const themeColors = useThemeColors();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const platforms = usePlatforms(userId);
  const mutation = usePlatformMutation();
  const [specsFor, setSpecsFor] = useState<number | null>(null);
  const [devicesFor, setDevicesFor] = useState<number | null>(null);
  const [choosingMain, setChoosingMain] = useState(false);
  const [removing, setRemoving] = useState<UserPlatform | null>(null);

  const rows = platforms.data ?? [];
  const byId = new Map(rows.map((r) => [r.platform_id, r]));
  const mainRow = rows.find((r) => r.is_main);
  const specsRow = specsFor !== null ? byId.get(specsFor) : undefined;
  const specsError = mutation.variables?.action === 'specs' && mutation.isError ? mutation.error.message : null;
  const devicesRow = devicesFor !== null ? byId.get(devicesFor) : undefined;
  const devicesError = mutation.variables?.action === 'devices' && mutation.isError ? mutation.error.message : null;

  if (platforms.isPending) return <RetroGamingPCSpinner label="Loading your hardware…" />;
  if (platforms.isError) return <RetroGamingPCAlert message={platforms.error.message} />;

  const remove = (row: UserPlatform) => {
    // Removing your Main hands it to the next platform you own (catalogue order).
    const next = row.is_main ? PLATFORMS.find((p) => p.id !== row.platform_id && byId.has(p.id)) : undefined;
    mutation.mutate({ action: 'remove', platformId: row.platform_id, nextMain: row.is_main ? next?.id : undefined });
  };
  const toggle = (platformId: number) => {
    const row = byId.get(platformId);
    if (!row) mutation.mutate({ action: 'add', platformId, makeMain: !mainRow });
    // Only ask when removing would throw away specs or devices you typed in.
    else if (row.pc_specs || row.devices.length > 0) setRemoving(row);
    else remove(row);
  };

  const detailRows = PLATFORMS.filter((p) => (p.hasSpecs || p.hasDevices) && byId.has(p.id)).map((p) => byId.get(p.id)!);
  const ownedInOrder = PLATFORMS.filter((p) => byId.has(p.id));

  return (
    <View className="gap-3">
      {mutation.isError && !specsError && !devicesError ? <RetroGamingPCAlert message={mutation.error.message} /> : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <Text className="retrogamingpc-label">Main platform</Text>
        <RetroGamingPCButton
          label={mainRow ? `${platformInfo(mainRow.platform_id).name} ▾` : rows.length > 0 ? 'Choose… ▾' : 'Add a platform first'}
          icon={<MaterialCommunityIcons name="star" size={12} color={themeColors.textBright} />}
          disabled={rows.length === 0}
          onPress={() => setChoosingMain(true)}
        />
        <View className="flex-1 items-end">
          <RetroGamingPCSaveStatus {...saveStatusOf(mutation)} />
        </View>
      </View>
      <Text className="-mt-1 text-retrogamingpc-xs text-retrogamingpc-text-muted">
        Tap a platform to add or remove it. Your Main is used for new ratings and marked ★.
      </Text>

      {PLATFORM_FAMILIES.map((family) => (
        <View key={family.key} className="gap-1">
          <Text className="retrogamingpc-label">{family.label}</Text>
          <View className="flex-row flex-wrap gap-1">
            {PLATFORMS.filter((p) => p.family === family.key).map((platform) => (
              <PlatformChip
                key={platform.id}
                platform={platform}
                owned={byId.has(platform.id)}
                main={mainRow?.platform_id === platform.id}
                onToggle={() => toggle(platform.id)}
              />
            ))}
          </View>
          {family.key === 'pc' && detailRows.length > 0 ? (
            <View className="mt-1 gap-1 border-l-2 border-l-retrogamingpc-accent pl-2">
              {detailRows.map((row) => (
                <DetailLine
                  key={row.platform_id}
                  row={row}
                  onEdit={() => (platformInfo(row.platform_id).hasSpecs ? setSpecsFor(row.platform_id) : setDevicesFor(row.platform_id))}
                />
              ))}
            </View>
          ) : null}
        </View>
      ))}

      <RetroGamingPCModal visible={choosingMain} title="Main platform" onClose={() => setChoosingMain(false)}>
        <View className="gap-1">
          {ownedInOrder.map((p) => {
            const isMain = mainRow?.platform_id === p.id;
            return (
              <Pressable
                key={p.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: isMain }}
                accessibilityLabel={p.name}
                onPress={() => {
                  if (!isMain) mutation.mutate({ action: 'setMain', platformId: p.id });
                  setChoosingMain(false);
                }}
                className={cn(
                  'min-h-[40px] flex-row items-center gap-2 border px-2',
                  isMain ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
                )}
              >
                <MaterialCommunityIcons name={isMain ? 'star' : platformIcon(p)} size={14} color={themeColors.textBright} />
                <Text className="flex-1 text-retrogamingpc-sm text-retrogamingpc-text-bright">{p.name}</Text>
                {isMain ? <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">Main</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </RetroGamingPCModal>

      <RetroGamingPCConfirmModal
        visible={removing !== null}
        title="Remove platform?"
        message={
          removing
            ? `Remove ${platformInfo(removing.platform_id).name}? Its ${platformInfo(removing.platform_id).hasSpecs ? 'specs' : 'device list'} will be deleted too.`
            : ''
        }
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) remove(removing);
          setRemoving(null);
        }}
      />

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
