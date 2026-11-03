import { useState } from 'react';
import { View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { EMPTY_PC_SPECS, PC_SPEC_FIELDS, pcSpecsSchema, type PcSpecKey, type PcSpecs } from '@/utils/profileSchemas';

type PcSpecsModalProps = {
  visible: boolean;
  platformName: string;
  initial: PcSpecs | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (specs: PcSpecs) => void;
};

export function PcSpecsModal({ visible, platformName, onClose, saving, ...formProps }: PcSpecsModalProps) {
  return (
    <RetroGamingPCModal visible={visible} title={`System Specs — ${platformName}`} onClose={onClose} dismissOnBackdrop={!saving}>
      {visible ? <PcSpecsForm {...formProps} saving={saving} onClose={onClose} /> : null}
    </RetroGamingPCModal>
  );
}

function PcSpecsForm({ initial, saving, error, onClose, onSave }: Omit<PcSpecsModalProps, 'visible' | 'platformName'>) {
  const [specs, setSpecs] = useState<PcSpecs>(initial ?? EMPTY_PC_SPECS);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<PcSpecKey, string>>>({});

  const submit = () => {
    const parsed = pcSpecsSchema.safeParse(specs);
    if (!parsed.success) {
      const next: Partial<Record<PcSpecKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as PcSpecKey | undefined;
        if (key) next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }
    onSave(parsed.data);
  };

  return (
    <View className="gap-2">
      {error ? <RetroGamingPCAlert message={error} /> : null}
      {PC_SPEC_FIELDS.map((field) => (
        <RetroGamingPCInput
          key={field.key}
          label={field.label}
          value={specs[field.key]}
          placeholder={field.placeholder}
          maxLength={120}
          autoCorrect={false}
          editable={!saving}
          error={fieldErrors[field.key]}
          onChangeText={(v) => setSpecs((s) => ({ ...s, [field.key]: v }))}
        />
      ))}
      <View className="flex-row justify-end gap-2 border-t border-t-retrogamingpc-accent pt-2">
        <RetroGamingPCButton label="Cancel" onPress={onClose} disabled={saving} />
        <RetroGamingPCButton label="Save Specs" variant="primary" loading={saving} onPress={submit} />
      </View>
    </View>
  );
}
