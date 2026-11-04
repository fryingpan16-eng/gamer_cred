import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { queryClient } from '@/services/queryClient';
import { bindAuthAutoRefreshToAppState, supabase } from '@/services/supabase';
import { DEFAULT_RATING_SCALE, type RatingScale } from '@/constants/ratingRubric';
import type { Profile } from '@/types/database.types';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

type AuthState = {
  /** `loading` until Supabase has restored (or failed to restore) the stored session. */
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileStatus: ProfileStatus;
  profileError: string | null;
  /** Browsing as a guest (anonymous sign-in, migration 000027): read-only, no profile. */
  isGuest: boolean;
  /** Subscribes to Supabase auth events. Call once from the root layout; returns cleanup. */
  initialize: () => () => void;
  refreshProfile: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()((set, get) => {
  async function loadProfile(userId: string): Promise<void> {
    set({ profileStatus: 'loading', profileError: null });
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    // Ignore responses for a user who has since signed out / switched accounts.
    if (get().user?.id !== userId) return;
    if (error) set({ profileStatus: 'error', profileError: error.message });
    else set({ profile: data, profileStatus: 'ready' });
  }

  return {
    status: 'loading',
    session: null,
    user: null,
    profile: null,
    profileStatus: 'idle',
    profileError: null,
    isGuest: false,

    initialize: () => {
      const unbindAppState = bindAuthAutoRefreshToAppState();

      // Fires INITIAL_SESSION once storage is read, then SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT …
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const previousUserId = get().user?.id;
        const user = session?.user ?? null;

        set({ session, user, status: session ? 'signedIn' : 'signedOut', isGuest: user?.is_anonymous === true });

        if (!user) {
          set({ profile: null, profileStatus: 'idle', profileError: null });
          // Never leak one account's cached data into the next session.
          if (event === 'SIGNED_OUT') queryClient.clear();
          return;
        }

        if (user.id !== previousUserId) {
          if (previousUserId) queryClient.clear();
          set({ profile: null });
          // Guests have no profile to load.
          if (user.is_anonymous) {
            set({ profileStatus: 'ready', profileError: null });
            return;
          }
          // Supabase warns against awaiting client calls inside this callback (lock deadlock).
          setTimeout(() => void loadProfile(user.id), 0);
        }
      });

      return () => {
        data.subscription.unsubscribe();
        unbindAppState();
      };
    },

    refreshProfile: async () => {
      const userId = get().user?.id;
      if (userId && !get().isGuest) await loadProfile(userId);
    },
  };
});

/** The viewer's primary rating scale (entry control + prominent display); Numeric by default. */
export function usePrimaryRatingScale(): RatingScale {
  return useAuthStore((s) => s.profile?.primary_rating_scale ?? DEFAULT_RATING_SCALE);
}

/**
 * The signed-in MEMBER's id; null for guests and signed-out visitors. Use it for
 * "my data" queries (my ratings, reviews, stats, friends…): guests have none, so
 * those requests are skipped instead of coming back empty.
 */
export function useMemberId(): string | null {
  return useAuthStore((s) => (s.isGuest ? null : (s.user?.id ?? null)));
}

/** True while browsing as a guest (read-only). */
export function useIsGuest(): boolean {
  return useAuthStore((s) => s.isGuest);
}

/** Convenience hook for screens: current auth snapshot. */
export function useAuth() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const profileStatus = useAuthStore((s) => s.profileStatus);
  return {
    status,
    user,
    profile,
    profileStatus,
    isLoading: status === 'loading',
    isSignedIn: status === 'signedIn',
  };
}
