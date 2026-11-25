import { useState } from 'react';
import { Text, View } from 'react-native';

import { PlatformPicker } from '@/components/studio/PlatformPicker';
import { GamePickerModal } from '@/components/studio/GamePickerModal';
import { RetroGamingPCButton } from '@/components/ui';
import { PLATFORMS, platformInfo } from '@/constants/platforms';
import { useMemberId } from '@/hooks/useAuth';
import { useLibrary, useLibraryMutations } from '@/hooks/useLibrary';
import { showToast } from '@/hooks/useToastStore';
import type { IgdbGameResult } from '@/types/igdb';
import { LIBRARY_FORMAT_LABELS, ownablePlatformIds, type LibraryFormat } from '@/utils/library';

import { LibraryChip } from './LibraryChip';
import { LibraryGameModal } from './LibraryGameModal';

/** Every real platform (GamerCred-only ids such as PC Handheld can't be owned on). */
const OWNABLE_IDS = PLATFORMS.filter((p) => p.id > 0).map((p) => p.id);
const FORMATS: LibraryFormat[] = ['physical', 'digital'];

/**
 * "+ Add games": quick multi-add. Pick a platform (and format) once, then tap
 * game after game; each goes in on that platform. A game that wasn't released
 * there asks which platform instead. The picker stays open until Done.
 */
export function LibraryAddGamesButton() {
  const viewerId = useMemberId();
  const library = useLibrary(viewerId);
  const { add } = useLibraryMutations();
  const [open, setOpen] = useState(false);
  const [platformId, setPlatformId] = useState<number | null>(null);
  const [format, setFormat] = useState<LibraryFormat | null>(null);
  const [asking, setAsking] = useState<IgdbGameResult | null>(null);
  const [added, setAdded] = useState(0);

  const entries = library.data ?? [];
  const unavailable = new Map<number, string>();
  const annotations = new Map<number, string>();
  for (const e of entries) {
    if (platformId !== null && e.platformId === platformId) unavailable.set(e.gameId, `Owned on ${platformInfo(platformId).short}`);
    else annotations.set(e.gameId, 'In Library');
  }

  const pick = (game: IgdbGameResult) => {
    if (platformId === null || !ownablePlatformIds(game).includes(platformId)) {
      setAsking(game);
      return;
    }
    add.mutate([{ gameId: game.id, platformId, format }]);
    setAdded((n) => n + 1);
    showToast(`Added ${game.name} (${platformInfo(platformId).short})`, 'success');
  };

  if (!viewerId) return null;
  return (
    <>
      <RetroGamingPCButton
        variant="create"
        label="+ Add games"
        onPress={() => {
          setAdded(0);
          setOpen(true);
        }}
      />
      <GamePickerModal
        visible={open}
        title="Add games to your Library"
        closeLabel={added > 0 ? `Done (${added} added)` : 'Done'}
        unavailable={unavailable}
        annotations={annotations}
        onClose={() => setOpen(false)}
        onPick={pick}
        header={
          <View className="gap-1.5 border-b border-retrogamingpc-accent pb-2">
            <PlatformPicker label="Adding on" allowNone={false} only={OWNABLE_IDS} value={platformId} onChange={setPlatformId} />
            <View className="flex-row flex-wrap items-center gap-1" accessibilityRole="radiogroup">
              <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Format</Text>
              {FORMATS.map((f) => (
                <LibraryChip key={f} label={LIBRARY_FORMAT_LABELS[f]} selected={format === f} onPress={() => setFormat(format === f ? null : f)} />
              ))}
            </View>
            <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
              {platformId === null
                ? 'Choose a platform, then tap each game you own on it. Or tap a game to pick its platform.'
                : `Tap each game you own on ${platformInfo(platformId).name}. Games not released there ask which platform.`}
            </Text>
            {/* Inside the picker, so it opens on top of it. */}
            {asking ? <LibraryGameModal game={asking} visible onClose={() => setAsking(null)} /> : null}
          </View>
        }
      />
    </>
  );
}
