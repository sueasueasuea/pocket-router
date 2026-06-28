'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase/client';

function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

/**
 * The actual logic component. Extracted from the default export so the
 * `useSearchParams` call below is wrapped in a Suspense boundary — Next 16
 * requires that for any client component that touches search params, or
 * the static-export step bails.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));

  useEffect(() => {
    // Supabase will automatically parse the hash segment in the URL
    // (e.g. #access_token=...) and establish the session client-side.
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push(nextPath);
      } else {
        // Wait a brief moment for the Supabase client to process the hash fragment if needed
        setTimeout(async () => {
          const { data: { session: retriedSession } } = await supabase.auth.getSession();
          if (retriedSession) {
            router.push(nextPath);
          } else {
            router.push('/login');
          }
        }, 1500);
      }
    };
    
    checkSession();
  }, [router, nextPath]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-zinc-200">Logging you in...</h2>
        <p className="text-sm text-zinc-500 mb-4">Please wait while we complete the authentication.</p>
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}