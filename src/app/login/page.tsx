'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { supabase } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Globe, Share2, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';

/**
 * Only allow same-origin relative paths as `next` redirects — defends
 * against open-redirect attacks if someone crafts a `/login?next=…`
 * link to an external host.
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Signup-only field — surfaced below the password input. Trimmed
  // value is forwarded as `options.data.display_name` so the
  // `on_auth_user_created` trigger writes it into `profiles`.
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin) {
      // Inline validation for the signup-only display name. Mirrors
      // the rule used in /onboarding/display-name so users can't
      // sneak an empty/short name past the trigger fallback.
      const trimmedName = displayName.trim();
      if (trimmedName.length < 2) {
        setError('Please enter a display name (at least 2 characters).');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Pass the display name through user metadata so the
            // `handle_new_user` trigger on auth.users inserts it
            // into `profiles.display_name`. Without this the
            // trigger falls back to the email's local-part, which
            // shows up as a half-broken name on shared invites.
            data: { display_name: displayName.trim() },
          },
        });
        if (error) throw error;
        alert('Check your email for the confirmation link.');
      }
      router.push(nextPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred during authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Include the `next` path so we can bounce to it after
          // the auth callback finishes.
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Google login');
    }
  };

  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const signOut = useAuthStore((state) => state.signOut);

  // `hasHydrated` gates the profile / currency editor so it doesn't flash the
  // default currency before Zustand has finished reading localStorage.
  // See `useHasHydrated` for the rationale.
  const hasHydrated = useHasHydrated();

  if (user) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>You are logged in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-zinc-100 dark:bg-zinc-900 p-3 rounded-md break-all">
              <span className="text-sm font-medium text-zinc-500">Email:</span>
              <p className="font-medium">{user.email}</p>
            </div>

            {/* Display name editor — keyed on user.id so a fresh mount
                seeds `useState` from the freshly-loaded profile, but a
                subsequent profile update (after Save) doesn't clobber
                the user's in-progress edit. The skeleton covers the
                brief window where `profile` is still null after login. */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <UserIcon className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Display name</span>
              </div>
              {profile ? (
                <DisplayNameEditor key={user.id} initialName={profile.display_name} />
              ) : (
                <DisplayNameEditorSkeleton />
              )}
            </div>

            {/* Currency Settings — keyed on hydration so the draft is
                initialized from the persisted value rather than the default. */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Settings</span>
              </div>
              {hasHydrated ? (
                <CurrencyEditor key="hydrated" />
              ) : (
                <CurrencyEditorSkeleton />
              )}
            </div>

            {/* Sharing entry — gate-kept to logged-in state. */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 space-y-2">
              <Link href="/settings/profile">
                <Button variant="outline" className="w-full justify-start">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Open settings
                </Button>
              </Link>
              <Link href="/settings/sharing">
                <Button variant="outline" className="w-full justify-start">
                  <Share2 className="w-4 h-4 mr-2" />
                  Sharing settings
                </Button>
              </Link>
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={async () => {
                await signOut();
                router.push('/');
              }}
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
        <div className="mt-8">
          <Button variant="link" className="text-zinc-500 text-sm" onClick={() => router.push('/')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md flex flex-col items-center mb-8">
        <div className="bg-primary/10 p-4 rounded-full mb-4">
          <Wallet className="w-12 h-12 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Pocket Router</h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-center">
          Manage your allocations beautifully
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{isLogin ? 'Welcome back' : 'Create an account'}</CardTitle>
          <CardDescription>
            {isLogin ? 'Enter your details to sign in.' : 'Enter your details to create an account.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailAuth} className="space-y-4">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Display name field — signup only. The HTML5
                `required` + `minLength={2}` mirror the inline JS
                validation above so the browser surfaces the same
                error natively on submit. */}
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder="How friends should see you"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={64}
                  autoComplete="name"
                />
                <p className="text-xs text-zinc-500">
                  Shown when you invite friends to view your wallet.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500">Or continue with</span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
              <path d="M1 1h22v22H1z" fill="none" />
            </svg>
            Google
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t p-4">
          <p className="text-sm text-zinc-500">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              className="text-primary hover:underline font-medium"
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
              }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </CardFooter>
      </Card>

      <div className="mt-8">
        <Button variant="link" className="text-zinc-500 text-sm" onClick={() => router.push('/')}>
          Continue as guest (Offline mode)
        </Button>
      </div>
    </div>
  );
}

/**
 * Currency draft editor. Kept in its own component so it can be remounted
 * (via `key`) once Zustand hydration completes — that way `useState` can
 * initialize the draft directly from the persisted `settings.currency`
 * without needing a `setState`-in-`useEffect` sync.
 */
function CurrencyEditor() {
  const settings = usePocketRouterStore((state) => state.settings);
  const updateSettings = usePocketRouterStore((state) => state.updateSettings);
  const [currency, setCurrency] = useState(settings.currency);

  return (
    <div className="space-y-2">
      <Label htmlFor="profile-currency">Default Currency</Label>
      <div className="flex gap-2">
        <Select value={currency} onValueChange={(val) => setCurrency(val ?? 'THB')}>
          <SelectTrigger id="profile-currency" className="flex-1">
            <SelectValue placeholder="Select Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="THB">THB (฿)</SelectItem>
            <SelectItem value="USD">USD ($)</SelectItem>
            <SelectItem value="EUR">EUR (€)</SelectItem>
            <SelectItem value="GBP">GBP (£)</SelectItem>
            <SelectItem value="JPY">JPY (¥)</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="rounded-full"
          onClick={() => updateSettings({ currency })}
          disabled={currency === settings.currency}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function CurrencyEditorSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-9 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-9 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Inline display-name editor — mirrors the pattern used by
 * `CurrencyEditor`: a local draft held in `useState` that initializes
 * from `initialName` (which the parent passes once the profile is
 * loaded), plus a Save button that commits via the store and rolls
 * back on failure. Save is disabled while the draft matches the saved
 * value (so we don't issue redundant upserts) or while a save is
 * already in flight.
 */
function DisplayNameEditor({ initialName }: { initialName: string }) {
  const updateDisplayName = useAuthStore((state) => state.updateDisplayName);
  // Seed from the prop so the first paint shows the right value
  // without a setState-in-effect dance. The parent remounts this
  // component (via `key={user.id}`) when the user changes, so a
  // freshly-logged-in account always starts with the right draft.
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const unchanged = trimmed === initialName.trim();
  const tooShort = trimmed.length < 2;

  const handleSave = async () => {
    if (saving || unchanged || tooShort) return;
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(trimmed);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save display name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="profile-display-name">Display name</Label>
      <div className="flex gap-2">
        <Input
          id="profile-display-name"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSave();
            }
          }}
          maxLength={64}
          placeholder="How friends should see you"
        />
        <Button
          size="sm"
          className="rounded-full"
          onClick={handleSave}
          disabled={saving || unchanged || tooShort}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
      {tooShort && draft.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Display name must be at least 2 characters.
        </p>
      )}
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

function DisplayNameEditorSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
      <div className="flex gap-2">
        <div className="h-9 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
        <div className="h-9 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

// Suspense wrapper — Next 16 requires any client component that calls
// `useSearchParams()` to live inside a Suspense boundary or the
// static-export step bails. We render a tiny skeleton as the fallback.
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
