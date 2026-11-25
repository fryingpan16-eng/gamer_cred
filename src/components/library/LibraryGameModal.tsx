import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCheckbox, RetroGamingPCModal } from '@/components/ui';
import { platformIcon, platformInfo } from '@/constants/platforms';
import { useLibraryMutations, useMyLibraryCopies } from '@/hooks/useLibrary';
import { useDividerColor, useThemeColors } from '@/hooks/useTheme';
import { showToast } from '@/hooks/useToastStore';
import { LIBRARY_FORMAT_LABELS, ownablePlatformIds, type LibraryFormat } from '@/utils/library';

import { LibraryChip } from './LibraryChip';

export type LibraryGameRef = {
  id: number;
  name: string;
  releasePlatformIds?: readonly number[];
  remasters?: readonly { platformIds?: readonly number[] }[];
  versions?: readonly { platformIds?: readonly number[] }[];
};

const FORMATS: LibraryFormat[] = ['physical', 'digital'];

/**
 * Which platforms you own a game on: one tick per platform it was released on
 * (IGDB), each with an optional Physical / Digital. Every tap saves.
 */
export function LibraryGameModal({ game, visible, onClose }: { game: LibraryGameRef; visible: boolean; onClose: () => void }) {
  const themeColors = useThemeColors();
  const divider = useDividerColor();
  const { copies } = useMyLibraryCopies(game.id);
  const { add, remove, setFormat } = useLibraryMutations();
  // Owned copies on platforms IGDB no longer lists still show, so they can be removed.
  const ownable = ownablePlatformIds(game);
  const platforms = [...ownable, ...copies.map((c) => c.platformId).filter((id) => !ownable.includes(id))];

  return (
    <RetroGamingPCModal
      visible={visible}
      title="Your Library"
      onClose={onClose}
      className="max-w-[440px]"
      footer={<RetroGamingPCButton variant="cancel" label="Done" onPress={onClose} />}
    >
      <View className="gap-2">
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text">
          Which platforms do you own <Text className="font-bold text-retrogamingpc-text-bright">{game.name}</Text> on?
        </Text>
        {platforms.length === 0 ? (
          <RetroGamingPCAlert tone="info" message="IGDB doesn't list a platform for this game that GamerCred knows yet, so it can't go in your Library." />
        ) : (
          platforms.map((platformId) => {
            const info = platformInfo(platformId);
            const copy = copies.find((c) => c.platformId === platformId);
            return (
              <View key={platformId} className="gap-1 border-b pb-2" style={{ borderBottomColor: divider }}>
                <View className="flex-row items-center gap-1.5">
                  <MaterialCommunityIcons name={platformIcon(info)} size={13} color={themeColors.textMuted} />
                  <RetroGamingPCCheckbox
                    className="flex-1"
                    checked={Boolean(copy)}
                    label={info.name}
                    onToggle={() => {
                      if (copy) {
                        remove.mutate({ gameId: game.id, platformId });
                        showToast(`Removed ${game.name} (${info.short}) from your library`, 'info');
                      } else {
                        add.mutate([{ gameId: game.id, platformId, format: null }]);
                        showToast(`Added ${game.name} (${info.short}) to your library`, 'success');
                      }
                    }}
                  />
                </View>
                {copy ? (
                  <View className="flex-row flex-wrap items-center gap-1 pl-6" accessibilityRole="radiogroup">
                    <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Format</Text>
                    {FORMATS.map((f) => (
                      <LibraryChip
                        key={f}
                        label={LIBRARY_FORMAT_LABELS[f]}
                        accessibilityLabel={`${info.name}: ${LIBRARY_FORMAT_LABELS[f]}`}
                        selected={copy.format === f}
                        onPress={() => setFormat.mutate({ gameId: game.id, platformId, format: copy.format === f ? null : f })}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          Your Library is separate from your ratings and backlog. Format is optional; tap it again to clear.
        </Text>
      </View>
    </RetroGamingPCModal>
  );
}
