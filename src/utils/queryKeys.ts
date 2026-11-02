/**
 * Centralized TanStack Query key factory.
 * Every useQuery/useMutation/invalidateQueries call MUST build its key here.
 */
export type SearchEntity = 'games' | 'studios' | 'users';

export const queryKeys = {
  all: ['gamercred'] as const,

  auth: {
    all: () => [...queryKeys.all, 'auth'] as const,
    session: () => [...queryKeys.auth.all(), 'session'] as const,
  },

  profiles: {
    all: () => [...queryKeys.all, 'profiles'] as const,
    detail: (userId: string) => [...queryKeys.profiles.all(), 'detail', userId] as const,
    platforms: (userId: string) => [...queryKeys.profiles.all(), 'platforms', userId] as const,
    favorites: (userId: string) => [...queryKeys.profiles.all(), 'favorites', userId] as const,
  },

  nowPlaying: {
    all: () => [...queryKeys.all, 'nowPlaying'] as const,
    byUser: (userId: string) => [...queryKeys.nowPlaying.all(), userId] as const,
  },

  reviews: {
    all: () => [...queryKeys.all, 'reviews'] as const,
    byGame: (gameId: number) => [...queryKeys.reviews.all(), 'game', gameId] as const,
    byUser: (userId: string) => [...queryKeys.reviews.all(), 'user', userId] as const,
    detail: (reviewId: string) => [...queryKeys.reviews.all(), 'detail', reviewId] as const,
  },

  friendships: {
    all: () => [...queryKeys.all, 'friendships'] as const,
    byUser: (userId: string) => [...queryKeys.friendships.all(), userId] as const,
    pending: (userId: string) => [...queryKeys.friendships.all(), userId, 'pending'] as const,
  },

  feed: {
    all: () => [...queryKeys.all, 'feed'] as const,
    community: () => [...queryKeys.feed.all(), 'community'] as const,
    friends: (userId: string) => [...queryKeys.feed.all(), 'friends', userId] as const,
  },

  games: {
    all: () => [...queryKeys.all, 'games'] as const,
    detail: (gameId: number) => [...queryKeys.games.all(), 'detail', gameId] as const,
  },

  search: {
    all: () => [...queryKeys.all, 'search'] as const,
    query: (entity: SearchEntity, term: string) =>
      [...queryKeys.search.all(), entity, term.trim().toLowerCase()] as const,
  },
} as const;
