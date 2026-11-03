import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { cn } from '@/utils/cn';
import { DEVICE_NAME_MAX, MAX_PLATFORM_DEVICES, platformDevicesSchema } from '@/utils/profileSchemas';
import { useThemeColors } from '@/hooks/useTheme';

type PlatformDevicesModalProps = {
  visible: boolean;
  platformName: string;
  initial: string[];
  suggestions: readonly string[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (devices: string[]) => void;
};

/** "Which handhelds do you have?" — quick-pick suggestions plus free typing. */
export function PlatformDevicesModal({ visible, platformName, onClose, saving, ...formProps }: PlatformDevicesModalProps) {
  return (
    <RetroGamingPCModal visible={visible} title={`Devices — ${platformName}`} onClose={onClose} dismissOnBackdrop={!saving}>
      {visible ? <DevicesForm {...formProps} saving={saving} onClose={onClose} /> : null}
    </RetroGamingPCModal>
  );
}

function DevicesForm({ initial, suggestions, saving, error, onClose, onSave }: Omit<PlatformDevicesModalProps, 'visible' | 'platformName'>) {
  const themeColors = useThemeColors();
  const [devices, setDevices] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const has = (name: string) => devices.some((d) => d.toLowerCase() === name.trim().toLowerCase());
  const full = devices.length >= MAX_PLATFORM_DEVICES;

  const add = (name: string) => {
    const parsed = platformDevicesSchema.safeParse([...devices, name]);
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Invalid device name');
      return;
    }
    setFieldError(null);
    setDevices(parsed.data);
    setDraft('');
  };
  const remove = (name: string) => setDevices((list) => list.filter((d) => d !== name));
  const toggleSuggestion = (name: string) => (has(name) ? remove(devices.find((d) => d.toLowerCase() === name.toLowerCase())!) : add(name));

  return (
    <View className="gap-3">
      {error ? <RetroGamingPCAlert message={error} /> : null}

      <View className="gap-1">
        <Text className="retrogamingpc-label">Your devices ({devices.length}/{MAX_PLATFORM_DEVICES})</Text>
        {devices.length === 0 ? (
          <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">None yet — pick below or type your own.</Text>
        ) : (
          <View className="flex-row flex-wrap gap-1">
            {devices.map((name) => (
              <Pressable
                key={name}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name}`}
                onPress={() => remove(name)}
                className="flex-row items-center gap-1 border border-retrogamingpc-highlight bg-retrogamingpc-active px-2 py-1"
              >
                <Text className="text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">{name}</Text>
                <Text className="text-retrogamingpc-xs text-retrogamingpc-text-bright">✕</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View className="gap-1">
        <Text className="retrogamingpc-label">Quick add</Text>
        <View className="flex-row flex-wrap gap-1">
          {suggestions.map((name) => {
            const selected = has(name);
            return (
              <Pressable
                key={name}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: full && !selected }}
                accessibilityLabel={name}
                disabled={full && !selected}
                onPress={() => toggleSuggestion(name)}
                className={cn(
                  'border px-2 py-1',
                  selected ? 'border-retrogamingpc-highlight bg-retrogamingpc-active' : 'border-retrogamingpc-accent bg-retrogamingpc-button',
                  full && !selected && 'opacity-40',
                )}
              >
                <Text className={cn('text-retrogamingpc-xs', selected ? 'font-bold text-retrogamingpc-text-bright' : 'text-retrogamingpc-text-muted')}>
                  {selected ? '✓ ' : ''}
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="flex-row items-start gap-2">
        <RetroGamingPCInput
          className="flex-1"
          label="Other device"
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            setFieldError(null);
          }}
          placeholder="e.g. Zotac Zone"
          maxLength={DEVICE_NAME_MAX}
          autoCorrect={false}
          returnKeyType="done"
          editable={!full && !saving}
          error={fieldError ?? undefined}
          hint={full ? `Maximum of ${MAX_PLATFORM_DEVICES} devices` : undefined}
          onSubmitEditing={() => draft.trim() && add(draft)}
          icon={<Feather name="cpu" size={12} color={themeColors.textMuted} />}
        />
        <RetroGamingPCButton variant="create" label="Add" className="mt-[18px]" disabled={full || draft.trim() === '' || saving} onPress={() => add(draft)} />
      </View>

      <View className="flex-row justify-end gap-2 border-t border-t-retrogamingpc-accent pt-2">
        <RetroGamingPCButton variant="cancel" label="Cancel" onPress={onClose} disabled={saving} />
        <RetroGamingPCButton variant="save" label="Save Devices" loading={saving} onPress={() => onSave(devices)} />
      </View>
    </View>
  );
}
