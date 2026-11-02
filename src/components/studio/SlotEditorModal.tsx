import { useState } from 'react';
import { View } from 'react-native';

import { SteamAlert, SteamButton, SteamInput, SteamModal, SteamScoreMeter } from '@/components/ui';
import type { NowPlaying } from '@/types/database.types';
import { NOTES_MAX_LENGTH, slotDetailsSchema } from '@/utils/reviewSchemas';

type SlotDetailsPayload = { notes: string | null; preliminary_score: number | null };

type SlotEditorModalProps = {
  visible: boolean;
  row: NowPlaying | undefined;
  gameTitle: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: SlotDetailsPayload) => void;
};

/** Running notes + preliminary score for an occupied slot. */
export function SlotEditorModal({ visible, row, gameTitle, saving, error, onClose, onSave }: SlotEditorModalProps) {
  return (
    <SteamModal visible={visible} title={`Notes — ${gameTitle}`} onClose={onClose} dismissOnBackdrop={!saving}>
      {/* Mounted per opening so the form always starts from the slot's saved values. */}
      {visible ? <SlotEditorForm row={row} saving={saving} error={error} onClose={onClose} onSave={onSave} /> : null}
    </SteamModal>
  );
}

function SlotEditorForm({ row, saving, error, onClose, onSave }: Omit<SlotEditorModalProps, 'visible' | 'gameTitle'>) {
  const [notes, setNotes] = useState(row?.notes ?? '');
  const [score, setScore] = useState<number | null>(row?.preliminary_score ?? null);
  const [fieldErrors, setFieldErrors] = useState<{ notes?: string; preliminaryScore?: string }>({});

  const submit = () => {
    const parsed = slotDetailsSchema.safeParse({ notes, preliminaryScore: score });
    if (!parsed.success) {
      const next: typeof fieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'notes' || key === 'preliminaryScore') next[key] ??= issue.message;
      }
      setFieldErrors(next);
      return;
    }
    onSave({
      notes: parsed.data.notes.length > 0 ? parsed.data.notes : null,
      preliminary_score: parsed.data.preliminaryScore,
    });
  };

  return (
    <View className="gap-3">
      {error ? <SteamAlert message={error} /> : null}
      <SteamScoreMeter label="Preliminary score" value={score} onChange={setScore} error={fieldErrors.preliminaryScore} />
      <SteamInput
        label="Running notes"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={NOTES_MAX_LENGTH}
        placeholder="Thoughts so far, where you are, what's clicking…"
        error={fieldErrors.notes}
        hint={`${notes.length.toLocaleString()} / ${NOTES_MAX_LENGTH.toLocaleString()}`}
        editable={!saving}
      />
      <View className="flex-row justify-end gap-2 border-t border-t-steam-accent pt-2">
        <SteamButton label="Cancel" onPress={onClose} disabled={saving} />
        <SteamButton label="Save" variant="primary" loading={saving} onPress={submit} />
      </View>
    </View>
  );
}
