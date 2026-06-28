import { create } from 'zustand';
import { supabase } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';
import { usePocketRouterStore } from './usePocketRouterStore';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  
  initialize: () => () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isLoading: true,
  isInitialized: false,
  
  initialize: () => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
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
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      set({ user: nextUser });
      // Session went away — covers manual signOut, refresh-token expiry,
      // server-side revocation, etc. Without this, an expired token leaves
      // the previous user's banks/pockets/allocations sitting in localStorage
      // until the next explicit logout. clearLocalData is idempotent so the
      // double-call during manual signOut (once here, once in signOut()) is
      // harmless.
      if (!nextUser) {
        usePocketRouterStore.getState().clearLocalData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
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
    set({ user: null, isLoading: false });
  }
}));
