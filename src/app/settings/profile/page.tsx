'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Globe,
  Loader2,
  Save,
  User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/hooks/useAuthStore';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';

export default function ProfileSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthInitialized = useAuthStore((s) => s.isInitialized);

  // Auth gate — bounce to /login (preserving the intended destination)
  // if the visitor isn't signed in. Mirrors the pattern from
  // /settings/sharing.
  useEffect(() => {
    if (isAuthInitialized && !user) {
      router.push('/login?next=/settings/profile');
    }
  }, [isAuthInitialized, user, router]);

  if (!isAuthInitialized || !user) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8">
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-3xl mx-auto w-full px-6 pt-6 pb-4 space-y-3">
          <Link
            href="/login"
            className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back to profile
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Profile
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Update how you appear to friends who can view your wallet.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-6 pt-6 flex flex-col gap-6">
        <ProfileCard />
        <CurrencyCard />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// ProfileCard — display name editor
// ---------------------------------------------------------------------

/**
 * Same UX as the inline `DisplayNameEditor` in /login, but in a
 * dedicated card with section-level spacing for the settings page.
 * Keeps the draft local so changes don't fire until the user hits Save.
 */
function ProfileCard() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  // While the profile is still loading (first mount before
  // refreshProfile resolves) we render a skeleton; once it arrives we
  // mount the editor with the right initial value. Keying on
  // user.id means a different account on the same device remounts
  // cleanly, but a profile update mid-session does NOT clobber the
  // user's in-progress edit.
  if (!profile) {
    return (
      <Card className="bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 space-y-2" aria-hidden>
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-3 w-64 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex gap-2" aria-hidden>
            <div className="h-9 flex-1 bg-zinc-200 dark:bg-zinc-800 rounded animate-pulse" />
            <div className="h-9 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-full animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <ProfileEditor
      key={user?.id ?? 'anon'}
      initialName={profile.display_name}
      onSaved={refreshProfile}
    />
  );
}

/**
 * Inner editor. Separated from `ProfileCard` so the `key` lives on a
 * pure presentational component — the parent owns the async/skeleton
 * gate, the editor owns the draft state. Saves surface inline errors
 * and a brief "Saved." toast.
 */
function ProfileEditor({
  initialName,
  onSaved,
}: {
  initialName: string;
  onSaved: () => Promise<unknown>;
}) {
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const trimmed = draft.trim();
  const unchanged = trimmed === initialName.trim();
  const tooShort = trimmed.length < 2;
  const canSave = !saving && !unchanged && !tooShort;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateDisplayName(trimmed);
      // Refresh so the input reflects the canonical value (handles
      // server-side normalization, e.g. extra whitespace stripping).
      // Parent passes the refresh hook so this component stays a pure
      // presenter (and testable in isolation).
      await onSaved();
      setSuccess(true);
      // Auto-clear the success chip after a couple of seconds so it
      // doesn't sit around stale.
      setTimeout(() => setSuccess(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save display name');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Display name
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Shown when you invite friends to view your wallet. Choose something
              you&apos;re happy being called.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-display-name">Display name</Label>
          <div className="flex gap-2">
            <Input
              id="settings-display-name"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleSave();
                }
              }}
              placeholder="How friends should see you"
              maxLength={64}
              aria-invalid={tooShort && draft.length > 0}
            />
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="rounded-full"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
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
          {success && !error && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Saved.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------
// CurrencyCard — lifted from /login, but with the full settings card
// chrome (icon, description, etc.) so it sits comfortably next to the
// display-name card.
// ---------------------------------------------------------------------

/**
 * Currency draft editor. Mirrors the inline `CurrencyEditor` in
 * /login, but with section-level chrome (icon, description, error
 * row). Uses the same `useHasHydrated` + `key` pattern so the draft
 * initializes from the persisted value without a setState-in-effect
 * dance.
 */
function CurrencyCard() {
  const hasHydrated = useHasHydrated();
  return (
    <Card className="bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Default currency
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">
              Used when displaying amounts across your banks and pockets.
            </p>
          </div>
        </div>

        {hasHydrated ? <CurrencyEditor key="hydrated" /> : <CurrencyEditorSkeleton />}
      </CardContent>
    </Card>
  );
}

function CurrencyEditor() {
  const settings = usePocketRouterStore((state) => state.settings);
  const updateSettings = usePocketRouterStore((state) => state.updateSettings);
  const [currency, setCurrency] = useState(settings.currency);

  return (
    <div className="space-y-2">
      <Label htmlFor="settings-currency">Currency</Label>
      <div className="flex gap-2">
        <Select value={currency} onValueChange={(val) => setCurrency(val ?? 'THB')}>
          <SelectTrigger id="settings-currency" className="flex-1">
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
