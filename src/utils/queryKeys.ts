import { normalizeSearchQuery, type IgdbEntityType } from '@/types/igdb';

/**
 * Centralized TanStack Query key factory.
 * Every useQuery/useMutation/invalidateQueries call MUST build its key here.
 */
/** Search tabs: IGDB-backed `games` / `companies`, Supabase-backed `users`. */
export type SearchEntity = 'games' | 'companies' | 'users' | 'lists';

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
    mine: (userId: string, status?: 'draft' | 'published') => [...queryKeys.reviews.all(), 'mine', userId, status ?? 'all'] as const,
    mineForGame: (userId: string, gameId: number) => [...queryKeys.reviews.all(), 'mine', userId, 'game', gameId] as const,
    byGame: (gameId: number) => [...queryKeys.reviews.all(), 'game', gameId] as const,
    /** Published reviews on a profile. */
    byUser: (userId: string) => [...queryKeys.reviews.all(), 'user', userId] as const,
    detail: (reviewId: string) => [...queryKeys.reviews.all(), 'detail', reviewId] as const,
    /** The review browser: one game, Community or Friends, in a sort order (migration 000030). */
    browseAll: () => [...queryKeys.reviews.all(), 'browse'] as const,
    browse: (gameId: number, scope: string, sort: string) => [...queryKeys.reviews.browseAll(), gameId, scope, sort] as const,
    /** The game page's first few community reviews. */
    preview: (gameId: number, sort: string, count: number) => [...queryKeys.reviews.browse(gameId, 'community', sort), 'preview', count] as const,
    /** ♥ on reviews: yours, plus counts on your own reviews. Ids sorted so equal sets share an entry. */
    likesAll: () => [...queryKeys.reviews.all(), 'likes'] as const,
    likes: (viewerId: string, reviewIds: readonly string[]) =>
      [...queryKeys.reviews.likesAll(), viewerId, [...new Set(reviewIds)].sort()] as const,
  },

  /** The signed-in user's own quick ratings (private; migration 000015). */
  ratings: {
    all: () => [...queryKeys.all, 'ratings'] as const,
    byUser: (userId: string) => [...queryKeys.ratings.all(), userId] as const,
    /** One batched lookup; ids are sorted + de-duplicated so equal sets share a cache entry. */
    mine: (userId: string, gameIds: readonly number[]) =>
      [...queryKeys.ratings.byUser(userId), [...new Set(gameIds)].sort((a, b) => a - b)] as const,
    /** A player's public ratings list (profiles). Separate prefix from the viewer's batches. */
    ofUserAll: () => [...queryKeys.ratings.all(), 'ofUser'] as const,
    ofUser: (userId: string) => [...queryKeys.ratings.ofUserAll(), userId] as const,
    /** The full spreadsheet list (same prefix, so rating changes refresh it). */
    table: (userId: string) => [...queryKeys.ratings.ofUserAll(), userId, 'table'] as const,
  },

  /** Game lists (migration 000019). */
  lists: {
    all: () => [...queryKeys.all, 'lists'] as const,
    pinned: () => [...queryKeys.lists.all(), 'pinned'] as const,
    /** Recently updated public lists (Home → Lists browser, before a search). */
    recent: () => [...queryKeys.lists.all(), 'recent'] as const,
    byUser: (userId: string) => [...queryKeys.lists.all(), 'user', userId] as const,
    detail: (listId: string) => [...queryKeys.lists.all(), 'detail', listId] as const,
    /** A smart list's live games (migration 000023). */
    smart: (listId: string) => [...queryKeys.lists.all(), 'smart', listId] as const,
    search: (term: string) => [...queryKeys.lists.all(), 'search', term] as const,
    isAdmin: (userId: string) => [...queryKeys.lists.all(), 'isAdmin', userId] as const,
  },

  /** Blocking, reports, moderation, terms (migration 000021). */
  safety: {
    all: () => [...queryKeys.all, 'safety'] as const,
    blocked: (userId: string) => [...queryKeys.safety.all(), 'blocked', userId] as const,
    blockState: (viewerId: string, otherId: string) => [...queryKeys.safety.all(), 'blockState', viewerId, otherId] as const,
    reports: (status: string) => [...queryKeys.safety.all(), 'reports', status] as const,
    /** Admin: profile pictures held by the screening check (migration 000022). */
    heldAvatars: () => [...queryKeys.safety.all(), 'heldAvatars'] as const,
    terms: (userId: string, version: string) => [...queryKeys.safety.all(), 'terms', userId, version] as const,
    /** Admin membership + two-step status for this sign-in (migration 000025). */
    adminStatus: (userId: string) => [...queryKeys.safety.all(), 'adminStatus', userId] as const,
    /** Admin activity log. */
    adminActivity: () => [...queryKeys.safety.all(), 'adminActivity'] as const,
  },

  friendships: {
    all: () => [...queryKeys.all, 'friendships'] as const,
    byUser: (userId: string) => [...queryKeys.friendships.all(), userId] as const,
    pending: (userId: string) => [...queryKeys.friendships.all(), userId, 'pending'] as const,
    /** Viewer's relationship to another player (direction-aware). */
    relation: (viewerId: string, otherId: string) => [...queryKeys.friendships.all(), viewerId, 'relation', otherId] as const,
    count: (userId: string) => [...queryKeys.friendships.all(), 'count', userId] as const,
    /** A player's friends page (plus pending requests when it's your own). */
    list: (userId: string) => [...queryKeys.friendships.all(), 'list', userId] as const,
  },

  feed: {
    all: () => [...queryKeys.all, 'feed'] as const,
    community: () => [...queryKeys.feed.all(), 'community'] as const,
    friends: (userId: string) => [...queryKeys.feed.all(), 'friends', userId] as const,
    /** Home → Community (migration 000020). */
    trendingGames: () => [...queryKeys.feed.all(), 'trendingGames'] as const,
    trendingPosts: () => [...queryKeys.feed.all(), 'trendingPosts'] as const,
  },

  /** Stats page aggregates — always the signed-in user's own (keyed per viewer). */
  /** ♥ likes (migration 000029). */
  likes: {
    all: () => [...queryKeys.all, 'likes'] as const,
    /** A game's like count + whether the viewer likes it. */
    game: (gameId: number, viewerId: string) => [...queryKeys.likes.all(), 'game', gameId, viewerId] as const,
    /** A player's liked games, newest first. */
    byUser: (userId: string) => [...queryKeys.likes.all(), 'user', userId] as const,
  },

  stats: {
    all: () => [...queryKeys.all, 'stats'] as const,
    byUser: (userId: string) => [...queryKeys.stats.all(), userId] as const,
    stat: (userId: string, stat: string, ...params: (string | number | null)[]) =>
      [...queryKeys.stats.byUser(userId), stat, ...params] as const,
  },

  games: {
    all: () => [...queryKeys.all, 'games'] as const,
    detail: (gameId: number) => [...queryKeys.games.all(), 'detail', gameId] as const,
    /** Full game page record (IGDB detail + RAWG requirements). */
    fullDetail: (gameId: number) => [...queryKeys.games.all(), 'fullDetail', gameId] as const,
    /** Published community reviews for a game (paginated) and their aggregate stats. */
    reviewsAll: () => [...queryKeys.games.all(), 'reviews'] as const,
    reviews: (gameId: number) => [...queryKeys.games.reviewsAll(), gameId] as const,
    reviewStatsAll: () => [...queryKeys.games.all(), 'reviewStats'] as const,
    /** The viewer's friends' reviews of a game (per viewer: depends on their friend list). */
    friendReviewsAll: () => [...queryKeys.games.all(), 'friendReviews'] as const,
    friendReviews: (viewerId: string, gameId: number) => [...queryKeys.games.friendReviewsAll(), viewerId, gameId] as const,
    /** Friends' ratings (quick or reviewed) — same prefix, so rating / review changes refresh both. */
    friendRatings: (viewerId: string, gameId: number) => [...queryKeys.games.friendReviewsAll(), 'ratings', viewerId, gameId] as const,
    reviewStats: (gameId: number) => [...queryKeys.games.reviewStatsAll(), gameId] as const,
    /** Batch lookup; ids are sorted so [2,1] and [1,2] share a cache entry. */
    lookup: (gameIds: readonly number[]) =>
      [...queryKeys.games.all(), 'lookup', [...new Set(gameIds)].sort((a, b) => a - b).join(',')] as const,
  },

  /** Studio pages (IGDB companies + their games). */
  companies: {
    all: () => [...queryKeys.all, 'companies'] as const,
    detail: (companyId: number) => [...queryKeys.companies.all(), 'detail', companyId] as const,
  },

  search: {
    all: () => [...queryKeys.all, 'search'] as const,
    entity: (entity: SearchEntity) => [...queryKeys.search.all(), entity] as const,
    /** Proxy-backed catalogue search (IGDB games/companies, RAWG creators). Viewer-independent. */
    igdb: (entity: IgdbEntityType, term: string) => [...queryKeys.search.all(), 'catalog', entity, normalizeSearchQuery(term)] as const,
    /** User search embeds the viewer's friendship state, so it is keyed per viewer. */
    users: (viewerId: string, term: string) => [...queryKeys.search.entity('users'), viewerId, term.trim().toLowerCase()] as const,
  },
} as const;
