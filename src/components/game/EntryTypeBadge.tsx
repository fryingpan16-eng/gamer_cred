import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { RetroGamingPCBadge } from '@/components/ui';
import { ENTRY_TYPE_LABELS, isAddOnEntry, type IgdbGameResult } from '@/types/igdb';

type EntryTypeBadgeProps = {
  game: Pick<IgdbGameResult, 'entryType' | 'parentGame' | 'collectionGames'>;
  /** Show the detail line: "DLC for <parent>" or "Includes <games>". */
  showDetail?: boolean;
};

const openGame = (id: number) => router.push({ pathname: '/game/[id]', params: { id: String(id) } });

/** "Includes Halo 3, Halo 4 +4 more" — first two names, then a count. */
function includesLine(games: { id: number; name: string }[]): string {
  const shown = games.slice(0, 2).map((g) => g.name).join(', ');
  return games.length > 2 ? `${shown} +${games.length - 2} more` : shown;
}

/**
 * Marks non-standard catalogue entries: Remake, Collection, Expansion, DLC.
 * Plain games show nothing. Add-ons name their parent game; collections list
 * what they include. Neither counts as a base game in top-game lists.
 */
export function EntryTypeBadge({ game, showDetail = true }: EntryTypeBadgeProps) {
  // Older proxy responses / cache rows have no entry type: treat them as plain games.
  const entryType = game.entryType ?? 'game';
  if (entryType === 'game') return null;
  const label = ENTRY_TYPE_LABELS[entryType];
  const addOn = isAddOnEntry(entryType);
  const collection = entryType === 'collection';
  const collectionGames = game.collectionGames ?? [];

  return (
    <View className="flex-row flex-wrap items-center gap-1">
      <RetroGamingPCBadge label={label} variant={addOn || collection ? 'draft' : 'published'} />
      {showDetail && addOn && game.parentGame ? (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">
          {label} for{' '}
          <Text accessibilityRole="link" className="text-retrogamingpc-text-bright underline" onPress={() => openGame(game.parentGame!.id)}>
            {game.parentGame.name}
          </Text>
        </Text>
      ) : null}
      {showDetail && collection && collectionGames.length > 0 ? (
        <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted" numberOfLines={1}>
          Includes {includesLine(collectionGames)}
        </Text>
      ) : null}
    </View>
  );
}

/** Full list of a collection's games for the game page, each linking to its own entry. */
export function CollectionContents({ games }: { games: { id: number; name: string }[] }) {
  if (games.length === 0) return null;
  return (
    <View className="gap-1">
      {games.map((g) => (
        <Text
          key={g.id}
          accessibilityRole="link"
          onPress={() => openGame(g.id)}
          className="text-retrogamingpc-sm text-retrogamingpc-text-bright underline"
        >
          ▸ {g.name}
        </Text>
      ))}
    </View>
  );
}
