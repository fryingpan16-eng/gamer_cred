import { MaterialCommunityIcons } from '@expo/vector-icons';

import { RetroGamingPCButton } from '@/components/ui';
import { LIKE_COLOR } from '@/constants/likeColor';
import { useGameLikes, useToggleLike } from '@/hooks/useLikes';

/**
 * ♥ Like on the game page: one tap, no rating or review needed. Shows how many
 * players like the game. (Guests see the join prompt instead; see GameHero.)
 */
export function LikeButton({ gameId, gameName }: { gameId: number; gameName: string }) {
  const likes = useGameLikes(gameId);
  const toggle = useToggleLike(gameId);
  const liked = likes.data?.liked ?? false;
  const count = likes.data?.count ?? 0;
  return (
    <RetroGamingPCButton
      label={`${liked ? 'Liked' : 'Like'}${count > 0 ? ` · ${count}` : ''}`}
      icon={<MaterialCommunityIcons name={liked ? 'heart' : 'heart-outline'} size={14} color={LIKE_COLOR} />}
      accessibilityLabel={`${liked ? 'Unlike' : 'Like'} ${gameName}. ${count} ${count === 1 ? 'player likes' : 'players like'} it`}
      accessibilityState={{ selected: liked }}
      disabled={likes.isPending}
      onPress={() => toggle.mutate(!liked)}
    />
  );
}
