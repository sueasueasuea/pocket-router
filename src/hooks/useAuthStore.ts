import { create } from 'zustand';
import { supabase } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { usePocketRouterStore } from './usePocketRouterStore';

/**
 * Minimal profile shape we need in this store. `profiles` also has
 * `created_at` but no other UI here cares about it, so we keep the
 * surface narrow.
 */
export interface Profile {
  display_name: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => () => void;
  signOut: () => Promise<void>;
  /**
   * Re-fetch the current user's `profiles` row. Safe to call when
   * `user` is null (returns null). Used after sign-in, on auth state
   * changes, and from the display-name editor after a save.
   */
  refreshProfile: () => Promise<Profile | null>;
  /**
   * Upsert `profiles.display_name` for the current user and mirror the
   * new value in the store. Throws on RLS / network error so the
   * editor can surface a message and roll back its draft.
   */
  updateDisplayName: (name: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isInitialized: false,

  initialize: () => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      set({
        user: session?.user ?? null,
        isLoading: false,
        isInitialized: true,
      });
      // Cold start with no session (cookie expired, server-side sign-out, or
      // a brand-new visitor). Wipe any stale persisted domain data left over
      // from a previous user on this device so they don't see ghost state on
      // first render. clearLocalData is idempotent — safe even if nothing was
      // ever persisted.
      if (!session) {
        usePocketRouterStore.getState().clearLocalData();
        // Lazy import — avoid circular module dependency with useInviteStore.
        void import('./useInviteStore').then(({ clearInviteState }) =>
          clearInviteState(),
        );
      } else {
        // Pull the matching `profiles` row so the rest of the UI
        // (Profile panel, invite landing, settings) can show the
        // user's display name immediately after refresh instead of
        // waiting for an explicit `refreshProfile()` call.
        await get().refreshProfile();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      set({ user: nextUser });
      // Session went away — covers manual signOut, refresh-token expiry,
      // server-side revocation, etc. Without this, an expired token leaves
      // the previous user's banks/pockets/allocations sitting in localStorage
      // until the next explicit logout. clearLocalData is idempotent so the
      // double-call during manual signOut (once here, once in signOut()) is
      // harmless.
      if (!nextUser) {
        set({ profile: null });
        usePocketRouterStore.getState().clearLocalData();
        const { clearInviteState } = await import('./useInviteStore');
        clearInviteState();
      } else {
        // New session — pull the matching profile. We deliberately
        // await this so callers (e.g. /auth/callback) can read the
        // freshly-fetched state on the next tick.
        await get().refreshProfile();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) {
      set({ profile: null });
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .maybeSingle();
      if (error) throw error;
      const profile: Profile | null = data
        ? { display_name: data.display_name ?? '' }
        : null;
      set({ profile });
      return profile;
    } catch (err) {
      // Don't poison the store with a stale profile on transient
      // errors — surface the failure via console and let the caller
      // decide whether to retry.
      console.error('Failed to load profile:', err);
      return null;
    }
  },

  updateDisplayName: async (name: string) => {
    const user = get().user;
    if (!user) throw new Error('Not signed in');
    const trimmed = name.trim();
    // Upsert so legacy users whose profile row never got a
    // display_name (or only an empty one) still land with a value.
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: trimmed }, { onConflict: 'id' });
    if (error) throw error;
    set({ profile: { display_name: trimmed } });
  },

  signOut: async () => {
    set({ isLoading: true });
    await supabase.auth.signOut();
    // Wipe the previous user's domain data + realtime channels so the next
    // session on this device starts clean. The zustand `persist` middleware
    // auto-writes the cleared state to localStorage on the next tick.
    // Note: a static `import { usePocketRouterStore }` would create a circular
    // module dependency (this file is already imported by usePocketRouterStore).
    // Referencing the binding lazily here (inside signOut) keeps the cycle safe
    // because both modules are fully evaluated by the time signOut runs.
    usePocketRouterStore.getState().clearLocalData();
    // Also clear invite state — same circular-import reasoning applies
    // (useInviteStore could import from us). Lazy import keeps the
    // dependency graph safe.
    const { clearInviteState } = await import('./useInviteStore');
    clearInviteState();
    set({ user: null, profile: null, isLoading: false });
  },
}));
