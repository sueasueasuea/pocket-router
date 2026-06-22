import { create } from 'zustand';
import { supabase } from '@/utils/supabase/client';
import { User } from '@supabase/supabase-js';

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
    set({ user: null, isLoading: false });
  }
}));
