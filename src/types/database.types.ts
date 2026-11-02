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
          updated_at: Timestamp;
        };
        Insert: {
          id: string;
          username: string;
          avatar_url?: string | null;
          updated_at?: Timestamp;
        };
        Update: {
          id?: string;
          username?: string;
          avatar_url?: string | null;
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
          rating: number | null;
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
          preliminary_score: number | null;
          updated_at: Timestamp;
        };
        Insert: {
          user_id: string;
          slot_index: NowPlayingSlot;
          game_id: number;
          notes?: string | null;
          preliminary_score?: number | null;
          updated_at?: Timestamp;
        };
        Update: {
          user_id?: string;
          slot_index?: NowPlayingSlot;
          game_id?: number;
          notes?: string | null;
          preliminary_score?: number | null;
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
        };
        Insert: {
          user_id: string;
          platform_id: number;
          is_main?: boolean;
          pc_specs?: string | null;
        };
        Update: {
          user_id?: string;
          platform_id?: number;
          is_main?: boolean;
          pc_specs?: string | null;
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
          review_count: number;
          average_rating: number | null;
          /** Counts for scores 1..10 (index 0 = score 1). */
          distribution: number[];
        }[];
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
    };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Row returned by the activity_feed RPC (migration 000006). */
export type ActivityFeedRow = {
  item_key: string;
  kind: 'review' | 'now_playing';
  occurred_at: Timestamp;
  actor_id: string;
  actor_username: string;
  actor_avatar_url: string | null;
  game_id: number;
  review_id: string | null;
  rating: number | null;
  excerpt: string | null;
  slot_index: NowPlayingSlot | null;
  preliminary_score: number | null;
};

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
export type NowPlaying = Tables<'now_playing'>;
export type UserFavorite = Tables<'user_favorites'>;
export type UserPlatform = Tables<'user_platforms'>;
export type IgdbCacheEntry = Tables<'igdb_cache'>;

export type FriendshipStatus = Enums<'friendship_status'>;
export type ReviewStatus = Enums<'review_status'>;
