'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Copy,
  Eye,
  Edit3,
  Loader2,
  Plus,
  Trash2,
  Share2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useInviteStore } from '@/hooks/useInviteStore';
import { buildInviteUrl } from '@/lib/invite-token';
import type { InvitePermission, ShareEntry, AcceptedShareEntry } from '@/types';

const MAX_INVITES = 50;

export default function SharingSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthInitialized = useAuthStore((s) => s.isInitialized);

  const {
    entries,
    acceptedShares,
    isLoading,
    lastError,
    fetchEntries,
    fetchAcceptedShares,
    createInvite,
    revokeInvite,
    updatePermission,
    deleteShareAccess,
    deleteAcceptedShare,
  } = useInviteStore();

  const [creating, setCreating] = useState(false);
  const [newPermission, setNewPermission] = useState<InvitePermission>('view');
  const [copyingToken, setCopyingToken] = useState<string | null>(null);

  // Auth gate.
  useEffect(() => {
    if (isAuthInitialized && !user) {
      router.push('/login?next=/settings/sharing');
    }
  }, [isAuthInitialized, user, router]);

  // Fetch entries once on mount (and when user changes).
  useEffect(() => {
    if (user) {
      fetchEntries();
      fetchAcceptedShares();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!isAuthInitialized || !user) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  const activeCount = entries.filter((e) => !e.invite.revoked).length;
  const atCap = activeCount >= MAX_INVITES;

  const handleCreate = async () => {
    if (creating || atCap) return;
    setCreating(true);
    await createInvite(newPermission);
    setCreating(false);
  };

  const handleCopy = async (token: string) => {
    const url = buildInviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopyingToken(token);
      setTimeout(() => setCopyingToken(null), 1500);
    } catch {
      // Fallback: select-and-prompt via a temporary textarea.
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopyingToken(token);
      setTimeout(() => setCopyingToken(null), 1500);
    }
  };

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8">
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-3xl mx-auto w-full px-6 pt-6 pb-4 space-y-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 cursor-pointer bg-transparent border-none p-0"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Sharing
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              Invite friends to view or edit your wallet.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-6 pt-6 flex flex-col gap-6">
        {/* Create-new card */}
        <Card className="bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Create a new invite link
                </h2>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Send the generated link to a friend. Once they sign in and accept,
                  they&apos;ll be able to view your wallet with the permission you choose.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-4 cursor-pointer">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Permission
                </label>
                <Select
                  value={newPermission}
                  onValueChange={(v) => setNewPermission((v as InvitePermission) ?? 'view')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">View only</SelectItem>
                    <SelectItem value="edit">View + Edit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || atCap}
                className="rounded-full cursor-pointer"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create link
                  </>
                )}
              </Button>
            </div>

            {atCap && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                You already have {MAX_INVITES} active invites. Revoke some before creating more.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Error surface */}
        {lastError && (
          <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm p-3 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{lastError}</span>
          </div>
        )}

        {/* Entries list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Active shares
            </h2>
            <span className="text-xs text-zinc-500">
              {activeCount} / {MAX_INVITES}
            </span>
          </div>

          {isLoading && entries.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : entries.length === 0 ? (
            <Card className="border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <CardContent className="p-8 text-center space-y-1">
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  No invites yet
                </p>
                <p className="text-xs text-zinc-500 max-w-[260px] mx-auto">
                  Create your first link above and share it with a friend.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <InviteRow
                  key={entry.invite.id}
                  entry={entry}
                  copyingToken={copyingToken}
                  onCopy={handleCopy}
                  onRevoke={() => revokeInvite(entry.invite.id)}
                  onChangePermission={(perm) =>
                    updatePermission(entry.invite.id, perm)
                  }
                  onDeleteShare={() =>
                    entry.shareAccess
                      ? deleteShareAccess(entry.shareAccess.id)
                      : Promise.resolve()
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* Accepted shares (shared with me) */}
        <section className="space-y-3 mt-4">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Wallets shared with you
          </h2>

          {isLoading && acceptedShares.length === 0 ? (
            <div className="flex items-center justify-center p-12 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : acceptedShares.length === 0 ? (
            <Card className="border-dashed border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <CardContent className="p-8 text-center space-y-1">
                <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  No shared wallets yet
                </p>
                <p className="text-xs text-zinc-500 max-w-[260px] mx-auto">
                  When someone shares their wallet and you accept, it will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {acceptedShares.map((share) => (
                <AcceptedShareRow
                  key={share.id}
                  share={share}
                  onLeave={() => deleteAcceptedShare(share.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// InviteRow
// ---------------------------------------------------------------------

function InviteRow({
  entry,
  copyingToken,
  onCopy,
  onRevoke,
  onChangePermission,
  onDeleteShare,
}: {
  entry: ShareEntry;
  copyingToken: string | null;
  onCopy: (token: string) => void;
  onRevoke: () => void;
  onChangePermission: (perm: InvitePermission) => void;
  onDeleteShare: () => void;
}) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [confirmDeleteShare, setConfirmDeleteShare] = useState(false);
  const { invite, shareAccess } = entry;
  const effectivePerm = shareAccess?.permission ?? invite.permission;
  const PermIcon = effectivePerm === 'edit' ? Edit3 : Eye;
  const justCopied = copyingToken === invite.token;

  return (
    <>
      <Card
        className={`bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800 ${
          invite.revoked ? 'opacity-60' : ''
        }`}
      >
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  effectivePerm === 'edit'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
                }`}
              >
                <PermIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 capitalize">
                    {effectivePerm === 'edit' ? 'View + Edit' : 'View only'}
                  </p>
                  {invite.revoked && (
                    <span className="cursor-pointer flex-1 py-1.5 text-xs font-bold uppercase tracking-wide bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">
                      Revoked
                    </span>
                  )}
                </div>
                {shareAccess ? (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate">
                    Shared with{' '}
                    <strong className="text-zinc-700 dark:text-zinc-300">
                      {shareAccess.acceptedByName || 'someone'}
                    </strong>
                    {' · accepted '}
                    {new Date(shareAccess.acceptedAt).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Waiting for someone to accept
                  </p>
                )}
                <code className="block text-[10px] font-mono text-zinc-400 truncate mt-1">
                  /invite/{invite.token}
                </code>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="icon-sm"
                variant="outline"
                 className="cursor-pointer"
                aria-label="Copy invite link"
                onClick={() => onCopy(invite.token)}
                disabled={invite.revoked || !!shareAccess}
              >
                {justCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </Button>
              {!invite.revoked && (
                <Button
                  size="icon-sm"
                  variant="outline"
                  className="cursor-pointer"
                  aria-label="Revoke invite"
                  onClick={() => setConfirmRevoke(true)}
                >
                  <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                </Button>
              )}
            </div>
          </div>

          {/* Permission switcher — applies to BOTH the invite (default
              for future acceptances) AND any existing share_access. */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-500">Permission</span>
            <Select
              value={effectivePerm}
              onValueChange={(v) => onChangePermission((v as InvitePermission) ?? 'view')}
              disabled={invite.revoked}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="view">View only</SelectItem>
                <SelectItem value="edit">View + Edit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cut-off button — only shown when someone actually accepted. */}
          {shareAccess && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
              onClick={() => setConfirmDeleteShare(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Remove access for {shareAccess.acceptedByName || 'this user'}
            </Button>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={confirmRevoke}
        onOpenChange={setConfirmRevoke}
        title="Revoke this invite?"
        description="The link will stop working immediately. Anyone who already accepted will keep access until you remove them separately."
        onConfirm={() => {
          setConfirmRevoke(false);
          onRevoke();
        }}
      />

      <ConfirmDeleteDialog
        open={confirmDeleteShare}
        onOpenChange={setConfirmDeleteShare}
        title="Remove this person's access?"
        description="They'll lose access right away. You can re-share later with a new link."
        onConfirm={() => {
          setConfirmDeleteShare(false);
          onDeleteShare();
        }}
      />
    </>
  );
}

function AcceptedShareRow({
  share,
  onLeave,
}: {
  share: AcceptedShareEntry;
  onLeave: () => void;
}) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const router = useRouter();

  return (
    <>
      <Card className="bg-white dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                share.permission === 'edit'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
              }`}
            >
              {share.permission === 'edit' ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                {share.ownerName}&apos;s Wallet
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Permission: <span className="font-medium text-zinc-700 dark:text-zinc-300 capitalize">{share.permission === 'edit' ? 'View + Edit' : 'View Only'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer text-xs"
              onClick={() => router.push(`/share/${share.token}`)}
            >
              View
            </Button>
            <Button
              size="icon-sm"
              variant="outline"
              className="cursor-pointer"
              aria-label="Leave shared wallet"
              onClick={() => setConfirmLeave(true)}
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-500 hover:text-rose-600" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={confirmLeave}
        onOpenChange={setConfirmLeave}
        title="Leave this shared wallet?"
        description="You will lose access to this wallet immediately. You will need a new invite to join again."
        onConfirm={() => {
          setConfirmLeave(false);
          onLeave();
        }}
      />
    </>
  );
}