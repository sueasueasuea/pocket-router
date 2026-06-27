'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { usePathname, useRouter } from 'next/navigation';

export function ClientProviders({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [initialize]);

  useEffect(() => {
    if (isInitialized) {
      const storageType = usePocketRouterStore.getState().settings.storageType;
      if (user) {
        if (storageType !== 'supabase') {
          usePocketRouterStore.getState().updateSettings({ storageType: 'supabase' });
        }
      } else {
        if (storageType !== 'local') {
          usePocketRouterStore.getState().updateSettings({ storageType: 'local' });
        }
      }
    }
  }, [user, isInitialized]);

  // Realtime: subscribe when signed in + cloud mode, unsubscribe otherwise.
  useEffect(() => {
    if (!isInitialized) return;
    const storageType = usePocketRouterStore.getState().settings.storageType;
    if (user && storageType === 'supabase') {
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
