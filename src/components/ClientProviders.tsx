'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialize]);

  // All storage is Supabase — subscribe to realtime and fetch fresh data
  // once auth finishes and a user is present.
  useEffect(() => {
    if (!isInitialized) return;
    if (user) {
      usePocketRouterStore.getState().fetchData();
      usePocketRouterStore.getState().subscribeRealtime();
    } else {
      usePocketRouterStore.getState().unsubscribeRealtime();
    }
    return () => {
      usePocketRouterStore.getState().unsubscribeRealtime();
    };
  }, [user, isInitialized]);

  return <>{children}</>;
}
