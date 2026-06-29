// IMPORTANT: vi.hoisted + vi.mock must appear before any import that
// pulls in the mocked module (which includes useAuthStore →
// '@/utils/supabase/client').
import { describe, it, expect, beforeEach, vi } from 'vitest';

// All spies are constructed inside `vi.hoisted` so they are
// instantiated BEFORE any vi.mock factory runs, and so they survive
// across the hoisted boundary.
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

// Mock the supabase client using the alias exactly as the store imports it.
vi.mock('@/utils/supabase/client', () => ({ supabase: mocks.supabase }));

vi.mock('./usePocketRouterStore', () => ({
  usePocketRouterStore: {
    getState: () => ({ clearLocalData: () => undefined }),
    setState: () => undefined,
  },
}));

// Now safe to import the store and its types.
import { useAuthStore, type Profile } from './useAuthStore';
import type { User } from '@supabase/supabase-js';

/** Helper to build a minimal auth-like User for store seeding. */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'tester@example.com',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
    ...overrides,
  } as User;
}

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

describe('useAuthStore', () => {
  beforeEach(() => {
    resetMocks();
    useAuthStore.setState({
      user: null,
      profile: null,
      isInitialized: true,
      isLoading: false,
    });
  });

  describe('updateDisplayName', () => {
    it('trims whitespace and upserts with the trimmed value, mirroring to profile', async () => {
      useAuthStore.setState({ user: makeUser({ id: 'abc' }) });

      await useAuthStore.getState().updateDisplayName('  Alice  ');

      expect(mocks.upsert).toHaveBeenCalledTimes(1);
      expect(mocks.upsert).toHaveBeenCalledWith(
        { id: 'abc', display_name: 'Alice' },
        { onConflict: 'id' },
      );

      const state = useAuthStore.getState();
      expect(state.profile).toEqual<Profile>({ display_name: 'Alice' });
      expect(mocks.signUp).not.toHaveBeenCalled();
      expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    });

    it('throws "Not signed in" and skips upsert when no user is set', async () => {
      useAuthStore.setState({ user: null });

      await expect(
        useAuthStore.getState().updateDisplayName('Bob'),
      ).rejects.toThrow('Not signed in');

      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(useAuthStore.getState().profile).toBeNull();
    });
  });

  describe('refreshProfile', () => {
    it('returns null and clears profile when no user is signed in', async () => {
      useAuthStore.setState({
        user: null,
        profile: { display_name: 'ghost' },
      });

      const result = await useAuthStore.getState().refreshProfile();

      expect(result).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(mocks.upsert).not.toHaveBeenCalled();
      expect(mocks.maybeSingle).not.toHaveBeenCalled();
    });
  });
});
