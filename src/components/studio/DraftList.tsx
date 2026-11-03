import { Text, View } from 'react-native';

import { RetroGamingPCAlert, RetroGamingPCButton, RetroGamingPCCard, RetroGamingPCPanel, RetroGamingPCRating, RetroGamingPCSpinner } from '@/components/ui';
import { useGameLookup } from '@/hooks/useGames';
import { useMyReviews } from '@/hooks/useReviews';
import { useStudioStore } from '@/hooks/useStudioStore';
import { reviewRating } from '@/utils/ratingColumns';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Backlog notes": the viewer's unpublished drafts, newest first. */
export function DraftList() {
  const drafts = useMyReviews('draft');
  const games = useGameLookup((drafts.data ?? []).map((d) => d.game_id));
  const startReview = useStudioStore((s) => s.startReview);
  const activeGameId = useStudioStore((s) => s.target?.gameId ?? null);

  return (
    <RetroGamingPCPanel title={`Drafts${drafts.data ? ` (${drafts.data.length})` : ''}`}>
      {drafts.isPending ? (
        <RetroGamingPCSpinner label="Loading drafts…" />
      ) : drafts.isError ? (
        <RetroGamingPCAlert message={drafts.error.message} />
      ) : drafts.data.length === 0 ? (
        <Text className="text-retrogamingpc-sm text-retrogamingpc-text-muted">
          No drafts. Save a review as a draft to keep quick backlog notes here.
        </Text>
      ) : (
        <View className="gap-2">
          {drafts.data.map((draft) => {
            const game = games.data?.get(draft.game_id);
            return (
              <RetroGamingPCCard key={draft.id} selected={activeGameId === draft.game_id} className="gap-1">
                <View className="flex-row items-center gap-2">
                  <Text className="flex-1 text-retrogamingpc-base font-bold text-retrogamingpc-text-bright" numberOfLines={1}>
                    {game?.name ?? `Game #${draft.game_id}`}
                  </Text>
                  <RetroGamingPCRating rating={reviewRating(draft)} size="compact" />
                </View>
                {draft.content ? (
                  <Text className="text-retrogamingpc-xs text-retrogamingpc-text" numberOfLines={2}>
                    {draft.content}
                  </Text>
                ) : null}
                <View className="flex-row items-center justify-between">
                  <Text className="text-retrogamingpc-xs text-retrogamingpc-text-muted">Edited {formatDate(draft.updated_at)}</Text>
                  <RetroGamingPCButton label="Resume" onPress={() => startReview({ gameId: draft.game_id })} />
                </View>
              </RetroGamingPCCard>
            );
          })}
        </View>
      )}
    </RetroGamingPCPanel>
  );
}
