'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { User as UserIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useRequireAuth } from '@/hooks/useRequireAuth';

/**
 * Only allow same-origin relative paths as the post-onboarding
 * redirect — defends against open-redirect attacks if the `next`
 * param ever came from an untrusted source (share-link, OAuth state,
 * etc.).
 */
function safeNextPath(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

function OnboardingDisplayNameInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get('next'));

  const { isReady, user } = useRequireAuth();
  const profile = useAuthStore((s) => s.profile);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  // If the auth store says the user already has a display name (e.g.
  // they refreshed the page after finishing onboarding), skip the
  // form and bounce straight to `next`. We only redirect when
  // `profile.display_name` is a non-blank string — the empty default
  // value means "still needs onboarding".
  useEffect(() => {
    if (
      isReady &&
      user &&
      profile &&
      profile.display_name.trim().length >= 2
    ) {
      router.replace(nextPath);
    }
  }, [isReady, user, profile, router, nextPath]);
  // `user` is non-null when `isReady` is true, but TS can't infer
  // that across the hook boundary — so we re-check it here for
  // narrowness.

  if (!isReady) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  // Hand off to the save-once form. We pass the current
  // `profile.display_name` (may be blank) as the initial draft so a
  // user who already has a stored name doesn't have to retype it
  // when bouncing through this page during a profile refresh race.
  return (
    <OnboardingForm
      email={user.email ?? ''}
      initialName={profile?.display_name ?? ''}
      nextPath={nextPath}
      onSaved={refreshProfile}
    />
  );
}

/**
 * Save-once form. Separated from the routing/auth logic so the
 * draft state stays out of any effect-based syncing.
 */
function OnboardingForm({
  email,
  initialName,
  nextPath,
  onSaved,
}: {
  email: string;
  initialName: string;
  nextPath: string;
  onSaved: () => Promise<unknown>;
}) {
  const updateDisplayName = useAuthStore((s) => s.updateDisplayName);
  const router = useRouter();
  const [draft, setDraft] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = draft.trim();
  const tooShort = trimmed.length < 2;
  const canSave = !saving && !tooShort;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(trimmed);
      // Make sure the store reflects the freshly-saved row before
      // we navigate — `useAuthStore` already mirrors the value, but
      // the explicit refresh guards against any RLS subtleties where
      // the upsert returns a normalized value.
      await onSaved();
      router.replace(nextPath);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save display name');
      setSaving(false);
    }
  };

  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 gap-6">
      <div className="w-full max-w-md flex flex-col items-center">
        <div className="bg-primary/10 p-4 rounded-full mb-3">
          <UserIcon className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          One last thing
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
          Pick a display name. Friends will see this when you invite them to view
          your wallet.
        </p>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Display name</CardTitle>
          <CardDescription>
            Signed in as <strong>{email}</strong>. You can change this
            anytime from your settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="onboarding-display-name">Display name</Label>
              <Input
                id="onboarding-display-name"
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="How friends should see you"
                maxLength={64}
                autoFocus
                aria-invalid={tooShort && draft.length > 0}
                aria-describedby="display-name-help"
              />
              <p id="display-name-help" className="text-xs text-zinc-500">
                At least 2 characters. Anything you choose here will be visible
                to anyone you share with.
              </p>
            </div>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!canSave}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save and continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

// Suspense boundary — Next 16 requires any client component that calls
// `useSearchParams()` to live inside Suspense or the static-export
// step bails.
export default function OnboardingDisplayNamePage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </main>
      }
    >
      <OnboardingDisplayNameInner />
    </Suspense>
  );
}
