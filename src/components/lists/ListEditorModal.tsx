import { useState } from 'react';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCheckbox, RetroGamingPCInput, RetroGamingPCModal } from '@/components/ui';
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX, listFormSchema, type ListFormValues } from '@/utils/listSchemas';
import { DEFAULT_SMART_RULE, describeSmartRule, type SmartRule } from '@/utils/smartLists';

import { SmartRuleFields, type SmartRuleDraft, type SmartRuleErrors } from './SmartRuleFields';

type ListEditorModalProps = {
  visible: boolean;
  /** Existing values when editing; omitted for a new list. */
  initial?: ListFormValues;
  /** The list is featured on Home (must stay public). */
  pinned?: boolean;
  /** Viewer is an app admin: new lists may be smart lists (and smart lists keep their rule editable). */
  allowSmart?: boolean;
  saving: boolean;
  error: string | null;
  onSave: (values: ListFormValues) => void;
  onClose: () => void;
};

const EMPTY: ListFormValues = { title: '', description: '', isRanked: false, isPublic: true, smartRule: null };

const toDraft = (rule: SmartRule): SmartRuleDraft => ({
  ...rule,
  yearFrom: rule.yearFrom === null ? '' : String(rule.yearFrom),
  yearTo: rule.yearTo === null ? '' : String(rule.yearTo),
  limit: String(rule.limit),
});

const fromDraft = (d: SmartRuleDraft) => ({
  ...d,
  yearFrom: d.yearFrom === '' ? null : Number(d.yearFrom),
  yearTo: d.yearTo === '' ? null : Number(d.yearTo),
  limit: d.limit === '' ? 0 : Number(d.limit),
});

function EditorBody({ initial, pinned, allowSmart = false, saving, error, onSave, onClose }: Omit<ListEditorModalProps, 'visible'>) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isRanked, setRanked] = useState(initial?.isRanked ?? EMPTY.isRanked);
  const [isPublic, setPublic] = useState(initial?.isPublic ?? EMPTY.isPublic);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; description?: string }>({});
  // Smart lists: offered to admins on new lists; an existing smart list keeps its rule editable.
  const canChooseSmart = allowSmart && !initial;
  const [smart, setSmart] = useState(Boolean(initial?.smartRule));
  const [rule, setRule] = useState<SmartRuleDraft>(toDraft(initial?.smartRule ?? DEFAULT_SMART_RULE));
  const [ruleErrors, setRuleErrors] = useState<SmartRuleErrors>({});

  const submit = () => {
    const smartRule = smart ? fromDraft(rule) : null;
    // An untitled smart list is named after its rule.
    const finalTitle =
      smart && title.trim() === '' && smartRule
        ? describeSmartRule({ ...DEFAULT_SMART_RULE, ...smartRule, limit: smartRule.limit || 500 })
        : title;
    const parsed = listFormSchema.safeParse({ title: finalTitle, description, isRanked, isPublic, smartRule });
    if (!parsed.success) {
      const next: { title?: string; description?: string } = {};
      const nextRule: SmartRuleErrors = {};
      for (const issue of parsed.error.issues) {
        const [key, sub] = issue.path;
        if ((key === 'title' || key === 'description') && next[key] === undefined) next[key] = issue.message;
        if (key === 'smartRule' && typeof sub === 'string' && sub in rule && nextRule[sub as keyof SmartRuleDraft] === undefined) {
          nextRule[sub as keyof SmartRuleDraft] = issue.message;
        }
      }
      setFieldErrors(next);
      setRuleErrors(nextRule);
      return;
    }
    setFieldErrors({});
    setRuleErrors({});
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
        placeholder={smart ? 'Leave blank to name it after the rule' : 'e.g. Best co-op games of the 2000s'}
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
      {canChooseSmart ? (
        <RetroGamingPCCheckbox
          checked={smart}
          onToggle={() => setSmart((v) => !v)}
          label="Smart list (admin)"
          description="Fills itself from Gamer Cred ratings using the rule below, e.g. Top 500 games or every S-tier game."
          disabled={saving}
        />
      ) : null}
      {smart ? <SmartRuleFields value={rule} onChange={setRule} errors={ruleErrors} disabled={saving} /> : null}
      {smart ? null : (
        <RetroGamingPCCheckbox
          checked={isRanked}
          onToggle={() => setRanked((v) => !v)}
          label="Ranked list"
          description="Show games as #1, #2, #3… in the order you arrange them."
          disabled={saving}
        />
      )}
      <RetroGamingPCCheckbox
        checked={isPublic}
        onToggle={() => setPublic((v) => !v)}
        label="Public"
        description={
          pinned
            ? 'Featured on Home, so it has to stay public.'
            : 'Anyone can find it in search and on your profile. Off = only you can see it.'
        }
        disabled={saving || pinned}
      />
      <View className="flex-row justify-end gap-2">
        <RetroGamingPCButton variant="cancel" label="Cancel" onPress={onClose} disabled={saving} />
        <RetroGamingPCButton variant="save" label={initial ? 'Save List' : 'Create List'} loading={saving} onPress={submit} />
      </View>
      {!initial && !smart ? (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Next you&apos;ll search for games to add.</Text>
      ) : null}
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
