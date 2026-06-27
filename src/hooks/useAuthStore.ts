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
        isInitialized: true 
      });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null });
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
