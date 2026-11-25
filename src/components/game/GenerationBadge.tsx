import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import { RetroGamingPCButton, RetroGamingPCModal } from '@/components/ui';
import { useGenerationBadge } from '@/hooks/useGameDetail';
import { useSoftShadow } from '@/hooks/useTheme';
import { generationBadgeView, type GenerationBadgeView } from '@/utils/generationBadge';
import { TOUCH_SLOP } from '@/utils/platform';

/** Rank tab sits over the badge's top-right corner. A style offset, never translate-* classes. */
const RANK_OFFSET = { top: -8, right: -8 } as const;

function DetailLines({ view }: { view: GenerationBadgeView }) {
  return (
    <View className="gap-1">
      {view.lines.map((line) => (
        <Text key={line} className="text-retrogamingpc-sm text-retrogamingpc-text">
          {line}
        </Text>
      ))}
    </View>
  );
}

/**
 * Top-right of the game page's main card: "Gen 6", or "PC" over the release
 * year, with the game's Top 250 place on the corner. Tap opens that
 * generation's list; long-press (or hover on desktop web) shows the details.
 */
export function GenerationBadge({ gameId }: { gameId: number }) {
  const query = useGenerationBadge(gameId);
  const shadow = useSoftShadow('button');
  const [detailOpen, setDetailOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const view = query.data ? generationBadgeView(query.data) : null;
  if (!view || !query.data) return null;
  const listId = query.data.listId;
  const openList = () => {
    if (listId) router.push({ pathname: '/list/[id]', params: { id: listId } });
    else setDetailOpen(true);
  };

  return (
    <View className="items-end">
      <Pressable
        accessibilityRole={listId ? 'link' : 'button'}
        accessibilityLabel={view.accessibilityLabel}
        accessibilityHint={listId ? 'Opens the list. Long press for details.' : 'Shows details.'}
        onPress={openList}
        onLongPress={() => setDetailOpen(true)}
        onHoverIn={Platform.OS === 'web' ? () => setHovered(true) : undefined}
        onHoverOut={Platform.OS === 'web' ? () => setHovered(false) : undefined}
        hitSlop={TOUCH_SLOP}
        className="min-h-[40px] min-w-[56px] items-center justify-center rounded border border-retrogamingpc-text-bright bg-retrogamingpc-highlight px-2.5 py-1"
        style={shadow}
      >
        <Text className="text-retrogamingpc-base font-bold uppercase tracking-wider text-retrogamingpc-ink" numberOfLines={1}>
          {view.label}
        </Text>
        {view.subLabel ? (
          <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-ink" numberOfLines={1}>
            {view.subLabel}
          </Text>
        ) : null}
        {view.rankText ? (
          <View
            className="absolute rounded-sm border border-retrogamingpc-highlight bg-retrogamingpc-dark px-1"
            style={RANK_OFFSET}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text className="font-mono text-retrogamingpc-xs font-bold text-retrogamingpc-text-bright">{view.rankText}</Text>
          </View>
        ) : null}
      </Pressable>

      {/* Desktop web: the details on hover, under the badge. */}
      {hovered && !detailOpen ? (
        <View
          className="retrogamingpc-bevel absolute right-0 top-full z-10 mt-1 w-64 gap-1 bg-retrogamingpc-panel p-2.5"
          style={shadow}
          pointerEvents="none"
        >
          <Text className="text-retrogamingpc-sm font-bold text-retrogamingpc-text-bright">{view.title}</Text>
          <DetailLines view={view} />
        </View>
      ) : null}

      <RetroGamingPCModal
        visible={detailOpen}
        title={view.title}
        onClose={() => setDetailOpen(false)}
        footer={
          <View className="flex-row flex-wrap justify-end gap-2">
            <RetroGamingPCButton label="Close" variant="cancel" onPress={() => setDetailOpen(false)} />
            {listId ? (
              <RetroGamingPCButton
                label="Open the list"
                variant="navigate"
                onPress={() => {
                  setDetailOpen(false);
                  openList();
                }}
              />
            ) : null}
          </View>
        }
      >
        <DetailLines view={view} />
      </RetroGamingPCModal>
    </View>
  );
}
