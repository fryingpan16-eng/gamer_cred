import { normalizeSearchQuery, type IgdbEntityType } from '@/types/igdb';

/**
 * Centralized TanStack Query key factory.
 * Every useQuery/useMutation/invalidateQueries call MUST build its key here.
 */
/** Search tabs: IGDB-backed `games` / `companies`, Supabase-backed `users`. */
export type SearchEntity = 'games' | 'companies' | 'users';

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
    /** The signed-in user's own reviews (drafts included), optionally filtered by status. */
    mine: (userId: string, status?: 'draft' | 'published') =>
      [...queryKeys.reviews.all(), 'mine', userId, status ?? 'all'] as const,
    mineForGame: (userId: string, gameId: number) => [...queryKeys.reviews.all(), 'mine', userId, 'game', gameId] as const,
    byGame: (gameId: number) => [...queryKeys.reviews.all(), 'game', gameId] as const,
    /** Published reviews on a profile. */
    byUser: (userId: string) => [...queryKeys.reviews.all(), 'user', userId] as const,
    detail: (reviewId: string) => [...queryKeys.reviews.all(), 'detail', reviewId] as const,
  },

  friendships: {
    all: () => [...queryKeys.all, 'friendships'] as const,
    byUser: (userId: string) => [...queryKeys.friendships.all(), userId] as const,
    pending: (userId: string) => [...queryKeys.friendships.all(), userId, 'pending'] as const,
    /** Viewer's relationship to another player (direction-aware). */
    relation: (viewerId: string, otherId: string) =>
      [...queryKeys.friendships.all(), viewerId, 'relation', otherId] as const,
    count: (userId: string) => [...queryKeys.friendships.all(), 'count', userId] as const,
  },

  feed: {
    all: () => [...queryKeys.all, 'feed'] as const,
    community: () => [...queryKeys.feed.all(), 'community'] as const,
    friends: (userId: string) => [...queryKeys.feed.all(), 'friends', userId] as const,
  },

  games: {
    all: () => [...queryKeys.all, 'games'] as const,
    detail: (gameId: number) => [...queryKeys.games.all(), 'detail', gameId] as const,
    /** Batch lookup; ids are sorted so [2,1] and [1,2] share a cache entry. */
    lookup: (gameIds: readonly number[]) =>
      [...queryKeys.games.all(), 'lookup', [...new Set(gameIds)].sort((a, b) => a - b).join(',')] as const,
  },

  search: {
    all: () => [...queryKeys.all, 'search'] as const,
    entity: (entity: SearchEntity) => [...queryKeys.search.all(), entity] as const,
    /** Proxy-backed catalogue search (IGDB games/companies, RAWG creators). Viewer-independent. */
    igdb: (entity: IgdbEntityType, term: string) =>
      [...queryKeys.search.all(), 'catalog', entity, normalizeSearchQuery(term)] as const,
    /** User search embeds the viewer's friendship state, so it is keyed per viewer. */
    users: (viewerId: string, term: string) =>
      [...queryKeys.search.entity('users'), viewerId, term.trim().toLowerCase()] as const,
  },
} as const;
