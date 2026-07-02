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

  // Guest mode is gone — every signed-in user is on cloud storage.
  // We still flip storageType to 'supabase' defensively in case a
  // previous session persisted 'local' (legacy guest-mode data) and
  // the same device is now signed in to a new account.
  useEffect(() => {
    if (!isInitialized) return;
    if (user) {
      const storageType = usePocketRouterStore.getState().settings.storageType;
      if (storageType !== 'supabase') {
        usePocketRouterStore.getState().updateSettings({ storageType: 'supabase' });
      }
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
