'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { useAuthStore } from './useAuthStore';

/**
 * Returned by `useRequireAuth`. Modelled as a discriminated union so
 * an `if (!result.isReady) return ...` early return narrows `user` to
 * a non-null `User` in the rest of the body — no separate `user &&`
 * check required at every access site.
 */
export type RequireAuthResult =
  | { isReady: true; user: User }
  | { isReady: false; user: null };

/**
 * Gate a page on authentication. Use for routes that should only be
 * reachable by signed-in users.
 *
 * - When auth initialization finishes and no user is present, redirects
 *   to `/login?next=<current-path>` so the visitor bounces back after
 *   signing in.
 * - Returns `isReady: true` only after auth has initialized AND a user
 *   is present. Pair with a spinner `if (!result.isReady) return ...`
 *   to prevent flash-of-content while the redirect is in flight.
 *
 * The redirect re-runs on every navigation. The root layout in this
 * app persists across route changes, so a one-shot `[]` effect would
 * only fire on initial app load — `pathname` in the deps array is what
 * makes this gate re-evaluate when the user moves between protected
 * pages.
 *
 * Public pages that need to *read* the user without redirecting (e.g.
 * `/invite/[token]`, which shows a preview to anonymous visitors)
 * should pull `useAuthStore` directly instead.
 */
export function useRequireAuth(): RequireAuthResult {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAuthInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    if (isAuthInitialized && !user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthInitialized, user, pathname, router]);

  if (isAuthInitialized && user) {
    return { isReady: true, user };
  }
  return { isReady: false, user: null };
}