import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { SteamAlert, SteamBadge, SteamButton, SteamCard, SteamPanel, SteamSpinner } from '@/components/ui';
import { PLATFORM_FAMILIES, PLATFORMS, platformInfo, type PlatformInfo } from '@/constants/platforms';
import { usePlatformMutation, usePlatforms } from '@/hooks/useProfile';
import type { UserPlatform } from '@/types/database.types';
import { cn } from '@/utils/cn';
import { parsePcSpecs, serializePcSpecs } from '@/utils/profileSchemas';

import { PcSpecsModal } from './PcSpecsModal';
import { SystemSpecsPanel } from './SystemSpecsPanel';

function PlatformChip({ platform, owned, onToggle }: { platform: PlatformInfo; owned: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: owned }}
      accessibilityLabel={platform.name}
      onPress={onToggle}
      className={cn(
        'border px-2 py-1',
        owned ? 'border-steam-highlight bg-steam-active' : 'border-steam-accent bg-steam-button',
      )}
    >
      <Text className={cn('text-steam-xs', owned ? 'font-bold text-steam-text-bright' : 'text-steam-text-muted')}>
        {owned ? '✓ ' : ''}
        {platform.short}
      </Text>
    </Pressable>
  );
}

function OwnedPlatformCard({
  row,
  editable,
  onSetMain,
  onEditSpecs,
}: {
  row: UserPlatform;
  editable: boolean;
  onSetMain: () => void;
  onEditSpecs: () => void;
}) {
  const info = platformInfo(row.platform_id);
  const specs = parsePcSpecs(row.pc_specs);

  return (
    <SteamCard selected={row.is_main} className="gap-2">
      <View className="flex-row items-center gap-2">
        <Text className="flex-1 text-steam-base font-bold text-steam-text-bright" numberOfLines={1}>
          {info.name}
        </Text>
        {row.is_main ? <SteamBadge label="Main Platform" variant="main" /> : null}
      </View>
      {info.hasSpecs && (specs || editable) ? (
        <SystemSpecsPanel title={info.short} specs={specs ?? { os: '', cpu: '', gpu: '', ram: '', storage: '' }} />
      ) : null}
      {editable ? (
        <View className="flex-row flex-wrap justify-end gap-2">
          {info.hasSpecs ? <SteamButton label={specs ? 'Edit Specs' : 'Add Specs'} onPress={onEditSpecs} /> : null}
          {!row.is_main ? <SteamButton label="Set as Main" variant="primary" onPress={onSetMain} /> : null}
        </View>
      ) : null}
    </SteamCard>
  );
}

type PlatformRosterProps = { userId: string; editable: boolean };

/** Hardware roster: owned platforms, one Main badge, PC spec sheets; owners toggle via chips. */
export function PlatformRoster({ userId, editable }: PlatformRosterProps) {
  const platforms = usePlatforms(userId);
  const mutation = usePlatformMutation();
  const [specsFor, setSpecsFor] = useState<number | null>(null);

  const rows = platforms.data ?? [];
  const owned = new Set(rows.map((r) => r.platform_id));
  const specsRow = specsFor !== null ? rows.find((r) => r.platform_id === specsFor) : undefined;
  const specsError = mutation.variables?.action === 'specs' && mutation.isError ? mutation.error.message : null;

  return (
    <SteamPanel title="Hardware & Platforms" headerRight={<SteamBadge label={`${rows.length} owned`} />}>
      {platforms.isPending ? (
        <SteamSpinner label="Loading roster…" />
      ) : platforms.isError ? (
        <SteamAlert message={platforms.error.message} />
      ) : (
        <View className="gap-3">
          {mutation.isError && !specsError ? <SteamAlert message={mutation.error.message} /> : null}

          {rows.length === 0 ? (
            <Text className="text-steam-sm text-steam-text-muted">
              {editable ? 'Tick the platforms you own below.' : 'No platforms listed.'}
            </Text>
          ) : (
            <View className="gap-2 md:flex-row md:flex-wrap">
              {rows.map((row) => (
                <View key={row.platform_id} className="md:w-[48%]">
                  <OwnedPlatformCard
                    row={row}
                    editable={editable}
                    onSetMain={() => mutation.mutate({ action: 'setMain', platformId: row.platform_id })}
                    onEditSpecs={() => setSpecsFor(row.platform_id)}
                  />
                </View>
              ))}
            </View>
          )}

          {editable ? (
            <View className="gap-2 border-t border-t-steam-accent pt-2">
              <Text className="steam-label">Owned platforms — tap to toggle</Text>
              {PLATFORM_FAMILIES.map((family) => (
                <View key={family.key} className="gap-1">
                  <Text className="text-steam-xs text-steam-text-muted">{family.label}</Text>
                  <View className="flex-row flex-wrap gap-1">
                    {PLATFORMS.filter((p) => p.family === family.key).map((platform) => (
                      <PlatformChip
                        key={platform.id}
                        platform={platform}
                        owned={owned.has(platform.id)}
                        onToggle={() =>
                          mutation.mutate({ action: owned.has(platform.id) ? 'remove' : 'add', platformId: platform.id })
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {editable ? (
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
      ) : null}
    </SteamPanel>
  );
}
