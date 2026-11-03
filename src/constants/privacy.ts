/** Who can see a player's Now Playing slots (profiles.now_playing_visibility, migration 000010). */
export type NowPlayingVisibility = 'public' | 'friends' | 'private';

export const NOW_PLAYING_VISIBILITIES: readonly NowPlayingVisibility[] = ['public', 'friends', 'private'];

export const DEFAULT_NOW_PLAYING_VISIBILITY: NowPlayingVisibility = 'public';

export const NOW_PLAYING_VISIBILITY_OPTIONS: Record<NowPlayingVisibility, { label: string; badge: string; description: string }> = {
  public: {
    label: 'Everyone',
    badge: '🌐 Public',
    description: 'Anyone can see what you’re playing on your profile, and friends see it in their activity feed.',
  },
  friends: {
    label: 'Friends only',
    badge: '👥 Friends only',
    description: 'Only accepted friends can see your Now Playing — on your profile and in their activity feed.',
  },
  private: {
    label: 'Only me',
    badge: '🔒 Private',
    description: 'Only you can see your Now Playing slots. They’re hidden on your profile and in friends’ feeds.',
  },
};
