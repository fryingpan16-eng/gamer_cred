/**
 * Supabase database types — hand-synced with supabase/migrations/000001_init_schema.sql.
 *
 * Shape matches `supabase gen types typescript` output so it can be replaced with
 * generated output later:
 *   npx supabase gen types typescript --local > src/types/database.types.ts
 *
 * NOTE: these must be `type` aliases (not interfaces) so they satisfy supabase-js's
 * `Record<string, …>` generic constraints.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** ISO-8601 timestamp string as returned by PostgREST for `timestamptz`. */
type Timestamp = string;

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '13';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          avatar_url: string | null;
          /** Scale the user enters ratings in (migration 000007). */
          primary_rating_scale: Database['public']['Enums']['rating_scale'];
          /** RetroGamingPC colour palette (migration 000009). */
          ui_theme: Database['public']['Enums']['ui_theme'];
          /** Who can see this player's Now Playing (RLS, migration 000010). */
          now_playing_visibility: Database['public']['Enums']['now_playing_visibility'];
          /** Who can see this player's backlog (migration 000035). */
          backlog_visibility: 'public' | 'private';
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          primary_rating_scale?: Database['public']['Enums']['rating_scale'];
          ui_theme?: Database['public']['Enums']['ui_theme'];
          now_playing_visibility?: Database['public']['Enums']['now_playing_visibility'];
          backlog_visibility?: 'public' | 'private';
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
          primary_rating_scale?: Database['public']['Enums']['rating_scale'];
          ui_theme?: Database['public']['Enums']['ui_theme'];
          now_playing_visibility?: Database['public']['Enums']['now_playing_visibility'];
          backlog_visibility?: 'public' | 'private';
          updated_at?: Timestamp;
        };
        Relationships: [];
      };

      friendships: {
        Row: {
          id: string;
          user_id: string;
          friend_id: string;
          status: Database['public']['Enums']['friendship_status'];
          created_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          friend_id: string;
          status?: Database['public']['Enums']['friendship_status'];
          created_at?: Timestamp;
        };
        Update: {
          id?: string;
          user_id?: string;
          friend_id?: string;
          status?: Database['public']['Enums']['friendship_status'];
          created_at?: Timestamp;
        };
        Relationships: [
          {
            foreignKeyName: 'friendships_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'friendships_friend_id_fkey';
            columns: ['friend_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      reviews: {
        Row: {
          id: string;
          user_id: string;
          game_id: number;
          /** Canonical numeric score 1–100 (migration 000007). */
          rating: number | null;
          /** Scale the rating was entered in; null when unrated. */
          rating_input_scale: Database['public']['Enums']['rating_scale'] | null;
          /** Raw input exactly as entered, e.g. "A+", "4.5", "NOT GOOD". */
          rating_input: string | null;
          /** Pre-000007 1–10 score, preserved for audit. */
          legacy_rating_10: number | null;
          /** Platform played on (catalog id; migration 000012). */
          platform_id: number | null;
          content: string | null;
          status: Database['public']['Enums']['review_status'];
          created_at: Timestamp;
          updated_at: Timestamp;
          /** Set by trigger when status first becomes 'published'; null for drafts. */
          published_at: Timestamp | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          game_id: number;
          rating?: number | null;
          rating_input_scale?: Database['public']['Enums']['rating_scale'] | null;
          rating_input?: string | null;
          legacy_rating_10?: number | null;
          platform_id?: number | null;
          content?: string | null;
          status?: Database['public']['Enums']['review_status'];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          published_at?: Timestamp | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          game_id?: number;
          rating?: number | null;
          rating_input_scale?: Database['public']['Enums']['rating_scale'] | null;
          rating_input?: string | null;
          legacy_rating_10?: number | null;
          platform_id?: number | null;
          content?: string | null;
          status?: Database['public']['Enums']['review_status'];
          created_at?: Timestamp;
          updated_at?: Timestamp;
          published_at?: Timestamp | null;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      now_playing: {
        Row: {
          user_id: string;
          slot_index: NowPlayingSlot;
          game_id: number;
          notes: string | null;
          /** Canonical numeric score 1–100 (migration 000007). */
          preliminary_score: number | null;
          preliminary_input_scale: Database['public']['Enums']['rating_scale'] | null;
          preliminary_input: string | null;
          legacy_preliminary_score_10: number | null;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          slot_index: NowPlayingSlot;
          game_id: number;
          notes?: string | null;
          preliminary_score?: number | null;
          preliminary_input_scale?: Database['public']['Enums']['rating_scale'] | null;
          preliminary_input?: string | null;
          legacy_preliminary_score_10?: number | null;
          updated_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          slot_index?: NowPlayingSlot;
          game_id?: number;
          notes?: string | null;
          preliminary_score?: number | null;
          preliminary_input_scale?: Database['public']['Enums']['rating_scale'] | null;
          preliminary_input?: string | null;
          legacy_preliminary_score_10?: number | null;
          updated_at?: Timestamp;
        };
        Relationships: [
          {
            foreignKeyName: 'now_playing_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      user_favorites: {
        Row: {
          user_id: string;
          game_id: number;
          rank: FavoriteRank;
        };
        Insert: {
          user_id: string;
          game_id: number;
          rank: FavoriteRank;
        };
        Update: {
          user_id?: string;
          game_id?: number;
          rank?: FavoriteRank;
        };
        Relationships: [
          {
            foreignKeyName: 'user_favorites_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      user_platforms: {
        Row: {
          user_id: string;
          platform_id: number;
          is_main: boolean;
          pc_specs: string | null;
          /** Specific hardware owned for this entry, e.g. ["Steam Deck OLED"] (migration 000008). */
          devices: string[];
        };
        Insert: {
          user_id: string;
          platform_id: number;
          is_main?: boolean;
          pc_specs?: string | null;
          devices?: string[];
        };
        Update: {
          user_id?: string;
          platform_id?: number;
          is_main?: boolean;
          pc_specs?: string | null;
          devices?: string[];
        };
        Relationships: [
          {
            foreignKeyName: 'user_platforms_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      /**
       * Quick ratings (migrations 000015–000016): one overall score + platform per
       * (user, game), separate from reviews. RLS: public read, owner write. Kept
       * equal to the score / platform on the user's review by sync triggers.
       */
      /** Games a player wants to play next (migration 000035). */
      game_backlog: {
        Row: { user_id: string; game_id: number; created_at: Timestamp };
        Insert: { user_id: string; game_id: number; created_at?: Timestamp };
        Update: { user_id?: string; game_id?: number; created_at?: Timestamp };
        Relationships: [];
      };
      /** ♥ on a review (migration 000030). Private: you only read your own rows. */
      review_likes: {
        Row: { user_id: string; review_id: string; created_at: Timestamp };
        Insert: { user_id: string; review_id: string; created_at?: Timestamp };
        Update: { user_id?: string; review_id?: string; created_at?: Timestamp };
        Relationships: [];
      };
      /** ♥ likes: one per player per game (migration 000029). */
      game_likes: {
        Row: { user_id: string; game_id: number; created_at: Timestamp };
        Insert: { user_id: string; game_id: number; created_at?: Timestamp };
        Update: { user_id?: string; game_id?: number; created_at?: Timestamp };
        Relationships: [];
      };
      game_ratings: {
        Row: {
          user_id: string;
          game_id: number;
          /** Canonical numeric score 1–100. */
          rating: number;
          rating_input_scale: Database['public']['Enums']['rating_scale'];
          /** Raw input exactly as entered, e.g. "4.5". */
          rating_input: string;
          /** Played on (catalog id = IGDB platform id; migration 000016). */
          platform_id: number | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          game_id: number;
          rating: number;
          rating_input_scale: Database['public']['Enums']['rating_scale'];
          rating_input: string;
          platform_id?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          game_id?: number;
          rating?: number;
          rating_input_scale?: Database['public']['Enums']['rating_scale'];
          rating_input?: string;
          platform_id?: number | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [
          {
            foreignKeyName: 'game_ratings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      /** App admins (migration 000019): may pin lists to Home. Readable only for your own row. */
      app_admins: {
        Row: { user_id: string; created_at: Timestamp };
        Insert: { user_id: string; created_at?: Timestamp };
        Update: { user_id?: string; created_at?: Timestamp };
        Relationships: [];
      };

      /** Game lists (migration 000019). Public lists readable by all; private by the owner only. */
      lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          /** Show positions as #1, #2 … */
          is_ranked: boolean;
          is_public: boolean;
          /** Home "Featured Lists" position (admin-only); null = not pinned. */
          pinned_rank: number | null;
          /** Smart list rule (admin-only, migration 000023); null = hand-picked games. */
          smart_rule: Json | null;
          created_at: Timestamp;
          updated_at: Timestamp;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          is_ranked?: boolean;
          is_public?: boolean;
          pinned_rank?: number | null;
          smart_rule?: Json | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          is_ranked?: boolean;
          is_public?: boolean;
          pinned_rank?: number | null;
          smart_rule?: Json | null;
          created_at?: Timestamp;
          updated_at?: Timestamp;
        };
        Relationships: [
          {
            foreignKeyName: 'lists_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };

      list_items: {
        Row: { list_id: string; game_id: number; position: number; added_at: Timestamp };
        Insert: { list_id: string; game_id: number; position: number; added_at?: Timestamp };
        Update: { list_id?: string; game_id?: number; position?: number; added_at?: Timestamp };
        Relationships: [
          {
            foreignKeyName: 'list_items_list_id_fkey';
            columns: ['list_id'];
            isOneToOne: false;
            referencedRelation: 'lists';
            referencedColumns: ['id'];
          },
        ];
      };

      /** Reports on user content (migration 000021). Reporter + admins read; admins resolve. */
      content_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_type: ReportTarget;
          target_id: string;
          target_user_id: string;
          reason: ReportReason;
          details: string | null;
          status: 'open' | 'actioned' | 'dismissed';
          created_at: Timestamp;
          resolved_at: Timestamp | null;
          resolved_by: string | null;
          resolution_note: string | null;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: ReportTarget;
          target_id: string;
          target_user_id: string;
          reason: ReportReason;
          details?: string | null;
        };
        Update: {
          status?: 'open' | 'actioned' | 'dismissed';
          resolved_at?: Timestamp | null;
          resolved_by?: string | null;
          resolution_note?: string | null;
        };
        Relationships: [];
      };

      terms_acceptances: {
        Row: { user_id: string; version: string; accepted_at: Timestamp };
        Insert: { user_id: string; version: string; accepted_at?: Timestamp };
        Update: { version?: string; accepted_at?: Timestamp };
        Relationships: [];
      };

      /** Durable IGDB metadata for Stats (migration 000014). Public read; Edge Function writes. */
      games: {
        Row: {
          igdb_id: number;
          name: string;
          release_year: number | null;
          community_rating: number | null;
          genres: string[];
          developers: string[];
          entry_type: string | null;
          /** IGDB franchises (migration 000029). */
          series: string[];
          updated_at: Timestamp;
        };
        Insert: {
          igdb_id: number;
          name: string;
          release_year?: number | null;
          community_rating?: number | null;
          genres?: string[];
          developers?: string[];
          entry_type?: string | null;
          updated_at?: Timestamp;
        };
        Update: {
          igdb_id?: number;
          name?: string;
          release_year?: number | null;
          community_rating?: number | null;
          genres?: string[];
          developers?: string[];
          entry_type?: string | null;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };

      /** Curation overrides (migration 000013). Service-role only: RLS has no client policies. */
      game_overrides: {
        Row: { igdb_id: number; action: 'include' | 'exclude'; note: string | null; created_at: Timestamp };
        Insert: { igdb_id: number; action: 'include' | 'exclude'; note?: string | null; created_at?: Timestamp };
        Update: { igdb_id?: number; action?: 'include' | 'exclude'; note?: string | null; created_at?: Timestamp };
        Relationships: [];
      };

      igdb_cache: {
        Row: {
          cache_key: string;
          data: Json;
          updated_at: Timestamp;
        };
        /** Writes are service-role only (Edge Functions); RLS blocks client writes. */
        Insert: {
          cache_key: string;
          data: Json;
          updated_at?: Timestamp;
        };
        Update: {
          cache_key?: string;
          data?: Json;
          updated_at?: Timestamp;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      is_username_available: {
        Args: { candidate: string };
        Returns: boolean;
      };
      set_main_platform: {
        /** null clears the Main platform. */
        Args: { p_platform_id: number | null };
        Returns: undefined;
      };
      set_favorite: {
        Args: { p_rank: FavoriteRank; p_game_id: number };
        Returns: undefined;
      };
      swap_favorite_ranks: {
        Args: { p_rank_a: FavoriteRank; p_rank_b: FavoriteRank };
        Returns: undefined;
      };
      game_review_stats: {
        Args: { p_game_id: number };
        Returns: {
          /** Number of ratings: one score per user, from reviews and quick ratings (migration 000015). */
          review_count: number;
          average_rating: number | null;
          /** Counts per numeric score 1..100 (index 0 = score 1); bucket into tiers via the rubric. */
          distribution: number[];
        }[];
      };
      // ---- Stats (migration 000014): all scoped to auth.uid() ----
      stats_rating_histogram: { Args: Record<string, never>; Returns: { score: number; games: number }[] };
      stats_platforms: { Args: Record<string, never>; Returns: { platform_id: number | null; games: number }[] };
      stats_developers: {
        Args: { p_limit?: number | null };
        Returns: { developer: string; games: number; total_studios: number }[];
      };
      /** Whether you like each review; like counts only for your own reviews (migration 000030). */
      review_like_info: {
        Args: { p_review_ids: string[] };
        Returns: { review_id: string; liked: boolean; like_count: number | null }[];
      };
      /** One game's published reviews for the review browser (migration 000030). */
      game_reviews_browse: {
        Args: {
          p_game_id: number;
          p_scope?: 'community' | 'friends';
          p_sort?: 'popular' | 'recent' | 'highest' | 'lowest';
          p_offset?: number;
          p_limit?: number;
        };
        Returns: {
          id: string;
          user_id: string;
          game_id: number;
          rating: number | null;
          rating_input_scale: Database['public']['Enums']['rating_scale'] | null;
          rating_input: string | null;
          content: string | null;
          platform_id: number | null;
          published_at: string | null;
          updated_at: string;
          author_username: string;
          author_avatar_url: string | null;
        }[];
      };
      /** Your liked games by series / studios / genres / era (migration 000029). */
      stats_liked: {
        Args: { p_dimension: 'series' | 'studios' | 'genres' | 'era'; p_limit?: number | null };
        Returns: { label: string; games: number; total_labels: number }[];
      };
      stats_genres: {
        Args: Record<string, never>;
        Returns: { genre: string; games: number; rated_games: number; average_rating: number | null }[];
      };
      stats_vs_community: { Args: { p_limit?: number }; Returns: Json };
      stats_release_years: { Args: Record<string, never>; Returns: { release_year: number | null; games: number }[] };
      stats_logged_over_time: { Args: Record<string, never>; Returns: { month: string; games: number }[] };
      /** Caller's logged games: reviewed or quick-rated (migration 000015). */
      my_logged_games: {
        Args: Record<string, never>;
        Returns: { game_id: number; first_logged: string; rating: number | null; platform_id: number | null }[];
      };
      friend_reviews_for_game: {
        Args: { p_game_id: number };
        Returns: FriendReviewRow[];
      };
      /** In app_admins AND the session is two-step verified (aal2) — migration 000025. */
      is_app_admin: { Args: Record<string, never>; Returns: boolean };
      /** In app_admins (grants nothing; lets the app offer the code prompt). */
      is_app_admin_member: { Args: Record<string, never>; Returns: boolean };
      /** Admin activity log, newest first (verified admins only). */
      admin_activity: {
        Args: { p_limit?: number };
        Returns: {
          id: number;
          created_at: string;
          admin_id: string | null;
          admin_name: string | null;
          action: string;
          target_type: string | null;
          target_id: string | null;
          details: Json | null;
        }[];
      };
      /** Safety (migration 000021). */
      block_user: { Args: { p_user: string }; Returns: undefined };
      unblock_user: { Args: { p_user: string }; Returns: undefined };
      my_blocked_users: {
        Args: Record<string, never>;
        Returns: { user_id: string; username: string; avatar_url: string | null; blocked_at: string }[];
      };
      block_state: { Args: { p_user: string }; Returns: 'none' | 'blocked_by_me' };
      admin_reports: {
        Args: { p_status?: 'open' | 'actioned' | 'dismissed'; p_limit?: number };
        Returns: {
          id: string;
          created_at: string;
          target_type: ReportTarget;
          target_id: string;
          target_user_id: string;
          target_username: string | null;
          reporter_username: string | null;
          reason: ReportReason;
          details: string | null;
          preview: string | null;
          content_exists: boolean;
          status: 'open' | 'actioned' | 'dismissed';
          open_reports_on_target: number;
        }[];
      };
      admin_resolve_reports: {
        Args: { p_target_type: ReportTarget; p_target_id: string; p_target_user: string; p_remove: boolean; p_note?: string | null };
        Returns: number;
      };
      /** Games most players rated or reviewed recently (migration 000020). */
      trending_games: {
        Args: { p_days?: number; p_limit?: number };
        Returns: { game_id: number; players: number; activity: number; average_rating: number | null; last_activity: string }[];
      };
      /** Recent published reviews of trending games (migration 000020). */
      trending_posts: { Args: { p_days?: number; p_limit?: number }; Returns: ActivityFeedRow[] };
      add_list_item: { Args: { p_list_id: string; p_game_id: number }; Returns: undefined };
      move_list_item: { Args: { p_list_id: string; p_game_id: number; p_to: number }; Returns: undefined };
      set_list_pin: { Args: { p_list_id: string; p_rank: number | null }; Returns: undefined };
      /** A smart list's games, live (migration 000023). Null when not smart / not visible. */
      smart_list_games: { Args: { p_list_id: string }; Returns: Json | null };
      /** A player's whole ratings list with game metadata (migration 000016). */
      user_ratings_table: {
        Args: { p_user_id: string };
        Returns: {
          game_id: number;
          rating: number;
          rating_input_scale: Database['public']['Enums']['rating_scale'];
          rating_input: string;
          platform_id: number | null;
          rated_at: string;
          name: string | null;
          release_year: number | null;
          genres: string[];
          developers: string[];
          community_rating: number | null;
          review_id: string | null;
        }[];
      };
      /** Friends' ratings of a game — quick or reviewed (migration 000016). */
      friend_ratings_for_game: {
        Args: { p_game_id: number };
        Returns: FriendRatingRow[];
      };
      activity_feed: {
        Args: {
          p_scope?: 'friends' | 'community';
          p_before?: string | null;
          p_before_key?: string | null;
          p_limit?: number;
        };
        Returns: ActivityFeedRow[];
      };
    };
    Enums: {
      friendship_status: 'pending' | 'accepted' | 'rejected';
      review_status: 'draft' | 'published';
      rating_scale: 'numeric' | 'tier' | 'stars' | 'rounded';
      ui_theme: 'olive' | 'blue' | 'red' | 'yellow' | 'pink';
      now_playing_visibility: 'public' | 'friends' | 'private';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Row returned by the friend_reviews_for_game RPC (migration 000012). */
export type ReportTarget = 'review' | 'list' | 'rating' | 'user';
export type ReportReason = 'spam' | 'harassment' | 'hate' | 'sexual' | 'violence' | 'self_harm' | 'impersonation' | 'spoilers' | 'other';

export type FriendRatingRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number;
  rating_input_scale: Database['public']['Enums']['rating_scale'];
  rating_input: string;
  platform_id: number | null;
  /** Set when the friend has a PUBLISHED review of this game. */
  review_id: string | null;
  rated_at: string;
};

export type FriendReviewRow = {
  review_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  rating: number | null;
  rating_input_scale: RatingScaleValue | null;
  rating_input: string | null;
  platform_id: number | null;
  published_at: Timestamp;
};

/** Row returned by the activity_feed RPC (migration 000006). */
export type ActivityFeedRow = {
  item_key: string;
  kind: 'review' | 'now_playing' | 'like';
  occurred_at: Timestamp;
  actor_id: string;
  actor_username: string;
  actor_avatar_url: string | null;
  game_id: number;
  review_id: string | null;
  rating: number | null;
  rating_input_scale: RatingScaleValue | null;
  rating_input: string | null;
  excerpt: string | null;
  slot_index: NowPlayingSlot | null;
  preliminary_score: number | null;
  preliminary_input_scale: RatingScaleValue | null;
  preliminary_input: string | null;
};

type RatingScaleValue = 'numeric' | 'tier' | 'stars' | 'rounded';

/** Slot range enforced by `check (slot_index between 1 and 4)`. */
export type NowPlayingSlot = 1 | 2 | 3 | 4;
/** Rank range enforced by `check (rank between 1 and 4)`. */
export type FavoriteRank = 1 | 2 | 3 | 4;

// -----------------------------------------------------------------------------
// Convenience helpers (same names as Supabase CLI output)
// -----------------------------------------------------------------------------
type PublicSchema = Database['public'];

export type TableName = keyof PublicSchema['Tables'];
export type Tables<T extends TableName> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends TableName> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends TableName> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type Profile = Tables<'profiles'>;
export type Friendship = Tables<'friendships'>;
export type Review = Tables<'reviews'>;
export type GameRating = Tables<'game_ratings'>;
export type GameList = Tables<'lists'>;
export type ListItem = Tables<'list_items'>;
export type NowPlaying = Tables<'now_playing'>;
export type UserFavorite = Tables<'user_favorites'>;
export type UserPlatform = Tables<'user_platforms'>;
export type IgdbCacheEntry = Tables<'igdb_cache'>;

export type FriendshipStatus = Enums<'friendship_status'>;
export type ReviewStatus = Enums<'review_status'>;
export type RatingScaleEnum = Enums<'rating_scale'>;
