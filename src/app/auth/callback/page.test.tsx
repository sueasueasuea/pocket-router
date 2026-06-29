// IMPORTANT: vi.hoisted + vi.mock must appear before any import that
// pulls in the mocked modules.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const navMocks = vi.hoisted(() => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  const searchParams = new URLSearchParams();
  let pathname = '/auth/callback';
  return { router, searchParams, getPathname: () => pathname, setPathname: (p: string) => { pathname = p; } };
});

vi.mock('next/navigation', () => ({
  useRouter: () => navMocks.router,
  useSearchParams: () => navMocks.searchParams,
  usePathname: () => navMocks.getPathname(),
  useParams: () => ({}),
}));

const mocks = vi.hoisted(() => {
  const signUp = vi.fn();
  const signInWithPassword = vi.fn();
  const signOut = vi.fn();
  const signInWithOAuth = vi.fn();
  const getSession = vi.fn();
  const onAuthStateChange = vi.fn();
  const upsert = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const maybeSingle = vi.fn();
  const update = vi.fn();
  const from = vi.fn();
  upsert.mockResolvedValue({ data: null, error: null });
  maybeSingle.mockResolvedValue({ data: null, error: null });
  getSession.mockResolvedValue({ data: { session: null }, error: null });
  signUp.mockResolvedValue({ data: {}, error: null });
  signInWithPassword.mockResolvedValue({ data: {}, error: null });
  signOut.mockResolvedValue({ error: null });
  signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: '' },
    error: null,
  });
  onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  // Each test sets up its own from() chain depending on which path
  // the test exercises. We default to a generic builder so typescript
  // is happy; tests override via from.mockImplementation.
  from.mockImplementation(() => ({ select, upsert, update }));
  select.mockImplementation(() => ({ eq, maybeSingle }));
  eq.mockImplementation(() => ({ maybeSingle }));
  return {
    signUp,
    signInWithPassword,
    signOut,
    signInWithOAuth,
    getSession,
    onAuthStateChange,
    from,
    select,
    upsert,
    eq,
    maybeSingle,
    update,
    supabase: {
      auth: { signUp, signInWithPassword, signOut, signInWithOAuth, getSession, onAuthStateChange },
      from,
    },
  };
});

vi.mock('@/utils/supabase/client', () => ({ supabase: mocks.supabase }));

vi.mock('@/hooks/usePocketRouterStore', () => ({
  usePocketRouterStore: {
    getState: () => ({ clearLocalData: () => undefined }),
    setState: () => undefined,
  },
}));

import AuthCallback from './page';

function resetMocks() {
  mocks.signUp.mockClear();
  mocks.signInWithPassword.mockClear();
  mocks.signOut.mockClear();
  mocks.signInWithOAuth.mockClear();
  mocks.getSession.mockClear();
  mocks.onAuthStateChange.mockClear();
  mocks.from.mockClear();
  mocks.select.mockClear();
  mocks.upsert.mockClear();
  mocks.update.mockClear();
  mocks.eq.mockClear();
  mocks.maybeSingle.mockClear();

  // Defaults.
  mocks.upsert.mockResolvedValue({ data: null, error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signUp.mockResolvedValue({ data: {}, error: null });
  mocks.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.signInWithOAuth.mockResolvedValue({
    data: { provider: 'google', url: '' },
    error: null,
  });
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mocks.from.mockImplementation(() => ({ select: mocks.select, upsert: mocks.upsert, update: mocks.update }));
  mocks.select.mockImplementation(() => ({ eq: mocks.eq, maybeSingle: mocks.maybeSingle }));
  mocks.eq.mockImplementation(() => ({ maybeSingle: mocks.maybeSingle }));
}

function resetNav() {
  navMocks.router.push.mockClear();
  navMocks.router.replace.mockClear();
  navMocks.router.back.mockClear();
  for (const k of Array.from(navMocks.searchParams.keys())) navMocks.searchParams.delete(k);
  navMocks.setPathname('/auth/callback');
}

describe('AuthCallback', () => {
  beforeEach(() => {
    resetMocks();
    resetNav();
    navMocks.searchParams.set('next', '/pockets');
  });

  it('Test #10: redirects to /onboarding/display-name when profile.display_name is too short', async () => {
    // Session present.
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'oauth-user' }, access_token: '', refresh_token: '' } },
      error: null,
    });
    // Profile present but with a too-short name.
    mocks.maybeSingle.mockResolvedValue({
      data: { display_name: 'A' },
      error: null,
    });

    render(<AuthCallback />);

    // The useEffect makes async calls (getSession + sleep 1500ms + redirect).
    // waitFor polls until the router call appears.
    await waitFor(
      () => {
        expect(navMocks.router.push).toHaveBeenCalledWith(
          `/onboarding/display-name?next=${encodeURIComponent('/pockets')}`,
        );
      },
      { timeout: 4000 },
    );
  });
});
