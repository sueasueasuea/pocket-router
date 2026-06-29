// IMPORTANT: vi.hoisted + vi.mock must appear before any import that
// pulls in the mocked modules.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock state for next/navigation. Defined inside vi.hoisted so the
// spy functions are stable across vi.mock factory execution.
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
  let pathname = '/login';
  return { router, searchParams, getPathname: () => pathname, setPathname: (p: string) => { pathname = p; } };
});

vi.mock('next/navigation', () => ({
  useRouter: () => navMocks.router,
  useSearchParams: () => navMocks.searchParams,
  usePathname: () => navMocks.getPathname(),
  useParams: () => ({}),
}));

// Supabase mock — see hooks/useAuthStore.test.ts for full reasoning.
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

// Stub `window.alert` so the signUp flow doesn't pop a dialog.
// (jsdom does not implement alert; it returns undefined for `alert`
// but we add an explicit spy to assert the popup happened.)
const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

// NOW we can import the page and the store.
import LoginPage from './page';
import { useAuthStore } from '@/hooks/useAuthStore';

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
  navMocks.setPathname('/login');
}

function resetStore() {
  useAuthStore.setState({
    user: null,
    profile: null,
    isInitialized: true,
    isLoading: false,
  });
}

describe('LoginPage — display-name feature', () => {
  beforeEach(() => {
    resetMocks();
    resetNav();
    resetStore();
    alertSpy.mockClear();
    // Default: no `next` param, root-relative redirect.
    navMocks.searchParams.delete('next');
  });

  it('Test #4: signup mode renders the display-name input with the correct attrs', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Default mode is `isLogin = true` — the input should NOT exist yet.
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();

    // Click the "Sign up" toggle at the bottom of the card.
    const toggle = screen.getByRole('button', { name: /^sign up$/i });
    await user.click(toggle);

    const input = screen.getByLabelText(/display name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'display-name');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('minLength', '2');
    expect(input).toHaveAttribute('maxLength', '64');
    expect(input).toHaveAttribute('autocomplete', 'name');
  });

  it('Test #5: signup blocks empty submit with inline error and skips signUp', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    // Toggle to signup mode. The footer button text is "Sign up" in login mode.
    await user.click(screen.getByRole('button', { name: /^sign up$/i }));

    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2');
    // Type only whitespace so HTML5 minLength=2 passes (raw length = 3)
    // but the JS `displayName.trim().length < 2` guard fires.
    await user.type(screen.getByLabelText(/display name/i), '   ');

    // The submit button now reads "Sign Up" (case differs from the
    // footer toggle "Sign in"). Match literally to avoid case-insensitive
    // collisions between "Sign Up" and "sign up" elsewhere.
    const submitButton = screen.getByRole('button', { name: 'Sign Up' });
    await user.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/please enter a display name/i),
      ).toBeInTheDocument();
    });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('Test #6: signup submits the trimmed display_name as user metadata', async () => {
    const user = userEvent.setup();
    // alert() can be called from signUp; spy it.
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: /^sign up$/i }));
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2');
    await user.type(screen.getByLabelText(/display name/i), '  Bob  ');

    await user.click(screen.getByRole('button', { name: /^sign up$/i }));

    await waitFor(() => {
      expect(mocks.signUp).toHaveBeenCalledTimes(1);
    });

    const payload = mocks.signUp.mock.calls[0][0] as {
      email: string;
      password: string;
      options?: { data?: { display_name?: unknown } };
    };
    expect(payload.email).toBe('a@b.com');
    expect(payload.password).toBe('hunter2');
    expect(payload.options?.data?.display_name).toBe('Bob');

    alertMock.mockRestore();
  });

  it('Test #7: login mode hides the display-name input', () => {
    render(<LoginPage />);

    // Default state is `isLogin = true`.
    expect(screen.queryByLabelText(/display name/i)).not.toBeInTheDocument();
    // Email + password are present.
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
  });
});
