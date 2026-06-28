'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
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
    let cancelled = false;
    // Supabase will automatically parse the hash segment in the URL
    // (e.g. #access_token=...) and establish the session client-side.
    const checkSession = async () => {
      // First attempt — Supabase usually parses the hash synchronously.
      let session = (await supabase.auth.getSession()).data.session;
      // Brief retry window for slow environments where the hash
      // listener fires after this effect's first `getSession` call.
      if (!session) {
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled) return;
        session = (await supabase.auth.getSession()).data.session;
      }
      if (cancelled) return;

      if (!session) {
        router.push('/login');
        return;
      }

      // Enforce display_name for OAuth users — they never see the
      // signup form, so the only place we can ask is here. If the
      // trigger fallback populated an empty / email-local-part name,
      // push them through the onboarding flow before the intended
      // destination.
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      const name = profile?.display_name?.trim() ?? '';
      if (name.length < 2) {
        router.push(
          `/onboarding/display-name?next=${encodeURIComponent(nextPath)}`,
        );
        return;
      }

      router.push(nextPath);
    };

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2 text-zinc-800 dark:text-zinc-200">Logging you in...</h2>
        <p className="text-sm text-zinc-500 mb-4">Please wait while we complete the authentication.</p>
        <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto" />
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
