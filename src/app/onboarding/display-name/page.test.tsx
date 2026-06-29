// IMPORTANT: vi.hoisted + vi.mock must appear before any import that
// pulls in the mocked modules.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
  let pathname = '/onboarding/display-name';
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
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    builder.select = select;
    builder.upsert = upsert;
    builder.update = update;
    builder.eq = eq;
    builder.maybeSingle = maybeSingle;
    return builder;
  };
  from.mockImplementation(() => makeBuilder());
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

// Stub window.alert (signUp flow).
const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

import OnboardingDisplayNamePage from './page';
import { useAuthStore } from '@/hooks/useAuthStore';
import type { User } from '@supabase/supabase-js';

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
  const makeBuilder = () => {
    const builder: Record<string, unknown> = {};
    builder.select = mocks.select;
    builder.upsert = mocks.upsert;
    builder.update = mocks.update;
    builder.eq = mocks.eq;
    builder.maybeSingle = mocks.maybeSingle;
    return builder;
  };
  mocks.from.mockImplementation(() => makeBuilder());
  mocks.select.mockImplementation(() => ({ eq: mocks.eq, maybeSingle: mocks.maybeSingle }));
  mocks.eq.mockImplementation(() => ({ maybeSingle: mocks.maybeSingle }));
}

function resetNav() {
  navMocks.router.push.mockClear();
  navMocks.router.replace.mockClear();
  navMocks.router.back.mockClear();
  for (const k of Array.from(navMocks.searchParams.keys())) navMocks.searchParams.delete(k);
  navMocks.setPathname('/onboarding/display-name');
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'onboard@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

function seedSignedInUserWithEmptyName() {
  useAuthStore.setState({
    user: makeUser(),
    profile: { display_name: '' },
    isInitialized: true,
    isLoading: false,
  });
}

describe('OnboardingDisplayNamePage', () => {
  beforeEach(() => {
    resetMocks();
    resetNav();
    alertSpy.mockClear();
    // Default: `next=%2Fpockets` so post-save redirect is deterministic.
    navMocks.searchParams.set('next', '/pockets');
  });

  it('Test #8: Save is disabled when draft < 2 chars, enabled at ≥ 2', async () => {
    seedSignedInUserWithEmptyName();

    const user = userEvent.setup();
    render(<OnboardingDisplayNamePage />);

    const input = await screen.findByLabelText(/display name/i);
    const saveButton = screen.getByRole('button', { name: /save and continue/i });

    // Disabled on empty draft.
    expect(saveButton).toBeDisabled();

    // Disabled at length 1.
    await user.clear(input);
    await user.type(input, 'A');
    expect(saveButton).toBeDisabled();

    // Enabled at length 2+.
    await user.clear(input);
    await user.type(input, 'Al');
    expect(saveButton).not.toBeDisabled();
  });

  it('Test #9: Save calls updateDisplayName → refreshProfile → router.replace(nextPath)', async () => {
    seedSignedInUserWithEmptyName();

    // Spy on refreshProfile so we can confirm it runs.
    const refreshSpy = vi.fn(async () => {
      useAuthStore.setState({ profile: { display_name: 'Charlie' } });
      return null;
    });
    // Replace the store method for this test only.
    const original = useAuthStore.getState().refreshProfile;
    useAuthStore.setState({ refreshProfile: refreshSpy } as never);

    try {
      const user = userEvent.setup();
      render(<OnboardingDisplayNamePage />);

      const input = await screen.findByLabelText(/display name/i);
      await user.type(input, 'Charlie');

      await user.click(screen.getByRole('button', { name: /save and continue/i }));

      // upsert called with trimmed value.
      await waitFor(() => {
        expect(mocks.upsert).toHaveBeenCalledTimes(1);
      });
      expect(mocks.upsert).toHaveBeenCalledWith(
        { id: 'user-1', display_name: 'Charlie' },
        { onConflict: 'id' },
      );

      // refreshProfile invoked once and router.replace fires with next path.
      await waitFor(() => {
        expect(refreshSpy).toHaveBeenCalledTimes(1);
        expect(navMocks.router.replace).toHaveBeenCalledWith('/pockets');
      });
    } finally {
      // Restore original to keep state isolation across tests.
      useAuthStore.setState({ refreshProfile: original } as never);
    }
  });
});
