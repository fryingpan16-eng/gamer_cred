import { useState } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCheckbox, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX, listFormSchema, type ListFormValues } from '@/utils/listSchemas';

type ListEditorModalProps = {
  visible: boolean;
  /** Existing values when editing; omitted for a new list. */
  initial?: ListFormValues;
  /** The list is featured on Home (must stay public). */
  pinned?: boolean;
  saving: boolean;
  error: string | null;
  onSave: (values: ListFormValues) => void;
  onClose: () => void;
};

const EMPTY: ListFormValues = { title: '', description: '', isRanked: false, isPublic: true };

function EditorBody({ initial, pinned, saving, error, onSave, onClose }: Omit<ListEditorModalProps, 'visible'>) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isRanked, setRanked] = useState(initial?.isRanked ?? EMPTY.isRanked);
  const [isPublic, setPublic] = useState(initial?.isPublic ?? EMPTY.isPublic);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string }>({});

  const submit = () => {
    const parsed = listFormSchema.safeParse({ title, description, isRanked, isPublic });
    if (!parsed.success) {
      const next: { title?: string; description?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if ((key === 'title' || key === 'description') && next[key] === undefined) next[key] = issue.message;
      }
      setFieldErrors(next);
      return;
    }
    setFieldErrors({});
    onSave(parsed.data);
  };

  return (
    <View className="gap-3">
      {error ? <RetroGamingPCAlert message={error} /> : null}
      <RetroGamingPCInput
        label="Title"
        value={title}
        onChangeText={setTitle}
        maxLength={LIST_TITLE_MAX}
        placeholder="e.g. Best co-op games of the 2000s"
        error={fieldErrors.title}
        editable={!saving}
        autoFocus={!initial}
      />
      <RetroGamingPCInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={LIST_DESCRIPTION_MAX}
        placeholder="What's this list about? (optional)"
        hint={`${description.length} / ${LIST_DESCRIPTION_MAX}`}
        error={fieldErrors.description}
        editable={!saving}
      />
      <RetroGamingPCCheckbox
        checked={isRanked}
        onToggle={() => setRanked((v) => !v)}
        label="Ranked list"
        description="Show games as #1, #2, #3… in the order you arrange them."
        disabled={saving}
      />
      <RetroGamingPCCheckbox
        checked={isPublic}
        onToggle={() => setPublic((v) => !v)}
        label="Public"
        description={pinned ? 'Featured on Home, so it has to stay public.' : 'Anyone can find it in search and on your profile. Off = only you can see it.'}
        disabled={saving || pinned}
      />
      <View className="flex-row justify-end gap-2">
        <RetroGamingPCButton variant="cancel" label="Cancel" onPress={onClose} disabled={saving} />
        <RetroGamingPCButton variant="save" label={initial ? 'Save List' : 'Create List'} loading={saving} onPress={submit} />
      </View>
      {!initial ? <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Next you&apos;ll search for games to add.</Text> : null}
    </View>
  );
}

/** Create or edit a list's title, description, ranking and visibility. */
export function ListEditorModal({ visible, onClose, ...rest }: ListEditorModalProps) {
  return (
    <RetroGamingPCModal visible={visible} title={rest.initial ? 'Edit List' : 'New List'} onClose={onClose} className="max-w-[480px]">
      {/* Mounted only while open, so it always starts from the current values. */}
      {visible ? <EditorBody onClose={onClose} {...rest} /> : null}
    </RetroGamingPCModal>
  );
}
