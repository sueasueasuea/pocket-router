'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, Edit3, ShieldCheck, AlertCircle, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthStore } from '@/hooks/useAuthStore';
import { supabase } from '@/utils/supabase/client';
import { isValidInviteTokenFormat } from '@/lib/invite-token';
import type { DbInvite, Invite, InvitePermission, InvitePreview } from '@/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; preview: InvitePreview; alreadyAccepted: boolean }
  | { kind: 'invalid'; message: string };

function mapInvite(row: DbInvite): Invite {
  return {
    id: row.id,
    ownerId: row.owner_id,
    token: row.token,
    permission: row.permission,
    createdAt: row.created_at,
    revoked: row.revoked,
  };
}

const PERMISSION_LABEL: Record<InvitePermission, string> = {
  view: 'view your wallets and banks',
  edit: 'view AND edit your wallets and banks',
};

const PERMISSION_ICON: Record<InvitePermission, typeof Eye> = {
  view: Eye,
  edit: Edit3,
};

export default function InviteLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const isAuthInitialized = useAuthStore((s) => s.isInitialized);

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const tokenIsValid = isValidInviteTokenFormat(token);

  // Load the invite + owner display name + check if current user has
  // already accepted (so we can route them straight to /share/[token]
  // instead of showing the accept button). Hooks must run
  // unconditionally — we therefore gate the actual work on
  // `tokenIsValid` inside the effect rather than returning early.
  useEffect(() => {
    if (!tokenIsValid) {
      // No work needed; the render below shows the invalid UI.
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data: inviteRow, error: inviteErr } = await supabase
          .from('invites')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (cancelled) return;

        if (inviteErr) {
          setState({ kind: 'invalid', message: inviteErr.message });
          return;
        }
        if (!inviteRow) {
          setState({
            kind: 'invalid',
            message: 'This invite link does not exist or has been revoked.',
          });
          return;
        }
        if (inviteRow.revoked) {
          setState({
            kind: 'invalid',
            message: 'This invite has been revoked by its owner.',
          });
          return;
        }

        // Resolve owner display name. profiles is readable by any
        // authenticated user (RLS), so we only attempt this once
        // logged in — but if we're not logged in yet, we'll show a
        // generic "Someone" until the user signs in.
        let ownerName = 'Someone';
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', inviteRow.owner_id)
            .maybeSingle();
          if (profile?.display_name) ownerName = profile.display_name;
        }

        // If we're logged in, check whether we already accepted.
        let alreadyAccepted = false;
        if (currentUser) {
          const { data: existing } = await supabase
            .from('share_access')
            .select('id')
            .eq('invite_id', inviteRow.id)
            .eq('accepted_by', currentUser.id)
            .maybeSingle();
          alreadyAccepted = !!existing;
        }

        const invite = mapInvite(inviteRow as DbInvite);
        setState({
          kind: 'ready',
          preview: { invite, owner: { id: invite.ownerId, displayName: ownerName } },
          alreadyAccepted,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: 'invalid',
          message: (err as Error)?.message || 'Failed to load invite.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // We depend on `user?.id` so the effect re-runs (and re-resolves
    // the owner's display name from `profiles`) when an anonymous
    // visitor finishes signing in. Without this, the landing page
    // would keep showing the "Someone" fallback forever after login.
  }, [token, tokenIsValid, user?.id]);

  const handleAccept = async () => {
    if (state.kind !== 'ready') return;
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) {
      // Bounce to login with a returnTo so they land back here.
      router.push(`/login?next=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setAcceptError(null);
    try {
      const { error } = await supabase.from('share_access').insert({
        invite_id: state.preview.invite.id,
        owner_id: state.preview.invite.ownerId,
        accepted_by: currentUser.id,
        permission: state.preview.invite.permission,
      });

      if (error) {
        // Unique-constraint violation → already accepted. Treat as
        // success and route forward.
        if (error.code === '23505') {
          router.push(`/share/${token}`);
          return;
        }
        throw error;
      }

      router.push(`/share/${token}`);
    } catch (err) {
      setAcceptError((err as Error)?.message || 'Failed to accept invite.');
      setAccepting(false);
    }
  };

  // -------- render branches --------

  if (!tokenIsValid) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
            </div>
            <CardTitle className="text-center">Invalid invite link</CardTitle>
            <CardDescription className="text-center">
              This URL doesn&apos;t look like a valid Pocket Router invite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Back to home</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (state.kind === 'loading' || !isAuthInitialized) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-zinc-500">Loading invite…</p>
      </main>
    );
  }

  if (state.kind === 'invalid') {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-rose-500" />
              </div>
            </div>
            <CardTitle className="text-center">Invite unavailable</CardTitle>
            <CardDescription className="text-center">{state.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Back to home</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { invite, owner } = state.preview;
  const PermIcon = PERMISSION_ICON[invite.permission];

  return (
    <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 gap-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-2">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center text-xl">
            {owner.displayName} invited you
          </CardTitle>
          <CardDescription className="text-center">
            to <strong>{PERMISSION_LABEL[invite.permission]}</strong> on Pocket Router.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <PermIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                {invite.permission} access
              </p>
              <p className="text-xs text-zinc-500">
                {invite.permission === 'edit'
                  ? 'You will be able to add, edit and remove items.'
                  : 'You can browse the wallet. Edits are not allowed.'}
              </p>
            </div>
          </div>

          {acceptError && (
            <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm p-3 rounded-lg">
              {acceptError}
            </div>
          )}

          {/* Logged-out branch: invite them to sign in / sign up */}
          {!user && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                Sign in or create an account to accept this invite.
              </p>
              <Link href={`/login?next=/invite/${token}`}>
                <Button className="w-full">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign in to accept
                </Button>
              </Link>
            </div>
          )}

          {/* Logged-in branch */}
          {user && (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                Signed in as <strong>{user.email}</strong>
              </p>
              {state.alreadyAccepted ? (
                <Button
                  className="w-full cursor-pointer"
                  onClick={() => router.push(`/share/${token}`)}
                >
                  Continue to view wallet
                </Button>
              ) : (
                <Button
                  className="w-full cursor-pointer"
                  onClick={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Accepting…
                    </>
                  ) : (
                    'Accept invite'
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        Not interested? Go to home →
      </Link>
    </main>
  );
}