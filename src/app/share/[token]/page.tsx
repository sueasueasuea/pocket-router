'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  Edit3,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/hooks/useAuthStore';
import { useSharedViewStore } from '@/hooks/useSharedViewStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import type { Bank, Pocket, Allocation, InvitePermission } from '@/types';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { BankDialog } from '@/components/BankDialog';
import { PocketDialog } from '@/components/PocketDialog';

export default function ShareViewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const isAuthInitialized = useAuthStore((s) => s.isInitialized);

  const {
    ownerId,
    ownerName,
    permission,
    banks,
    pockets,
    allocations,
    settings,
    isLoading,
    lastError,
    loadSharedView,
    reset,
    addBank,
    addPocket,
    updateAllocation,
    deleteAllocation,
  } = useSharedViewStore();

  const hasHydrated = useHasHydrated();

  const [loadFailed, setLoadFailed] = useState<string | null>(null);

  // Load on mount, reset on unmount.
  useEffect(() => {
    let cancelled = false;
    if (!isAuthInitialized) return;
    if (!user) {
      router.push(`/login?next=/share/${token}`);
      return;
    }
    (async () => {
      const ok = await loadSharedView(token);
      if (cancelled) return;
      if (!ok) {
        setLoadFailed(lastError || "You don't have access to this share.");
      }
    })();
    return () => {
      cancelled = true;
      reset();
    };
    // We intentionally only depend on token + isAuthInitialized; if
    // `user` changes mid-flight we let the effect re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isAuthInitialized, user?.id]);

  // -------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------

  if (!isAuthInitialized || (isLoading && !ownerId)) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-zinc-500">Loading shared wallet…</p>
      </main>
    );
  }

  if (loadFailed) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <div className="flex justify-center pt-6">
            <div className="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-950/40 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
          </div>
          <div className="p-6 space-y-4 text-center">
            <h2 className="font-semibold text-lg">Cannot view this wallet</h2>
            <p className="text-sm text-zinc-500">{loadFailed}</p>
            <div className="flex flex-col gap-2 pt-2">
              <Link href="/">
                <Button className="w-full">Back to my wallet</Button>
              </Link>
              <Link href={`/invite/${token}`}>
                <Button variant="outline" className="w-full">
                  View invite again
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </main>
    );
  }

  if (!ownerId || !permission) {
    // Defensive — shouldn't reach here after the loading/error paths
    // above, but keeps TS happy.
    return null;
  }

  const canEdit = permission === 'edit';

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8">
      {/* Header with shared-view banner */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-6 pb-4 space-y-3">
          <Link
            href="/"
            className="inline-flex items-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Back to my wallet
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {ownerName}&apos;s wallet
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Viewing via shared invite
              </p>
            </div>
            <span
              className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                canEdit
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'
              }`}
            >
              {canEdit ? (
                <Edit3 className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              {canEdit ? 'Edit access' : 'View only'}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-8">
        <SharedSummary
          banks={banks}
          allocations={allocations}
          settings={settings}
        />

        {/* Banks section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Banks</h2>
            {canEdit && <AddBankButton onAdd={addBank} />}
          </div>
          {banks.length === 0 ? (
            <EmptyHint
              label="No banks yet"
              hint={canEdit ? 'Add a bank to start allocating.' : 'The owner has no banks yet.'}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {banks.map((bank) => (
                <SharedBankCard
                  key={bank.id}
                  bank={bank}
                  allocations={allocations}
                  settings={settings}
                />
              ))}
            </div>
          )}
        </section>

        {/* Pockets section */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Pockets</h2>
            {canEdit && <AddPocketButton onAdd={addPocket} />}
          </div>
          {pockets.length === 0 ? (
            <EmptyHint
              label="No pockets yet"
              hint={canEdit ? 'Add a pocket to organize goals.' : 'The owner has no pockets yet.'}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {pockets.map((pocket) => (
                <SharedPocketCard
                  key={pocket.id}
                  pocket={pocket}
                  allocations={allocations}
                  banks={banks}
                  settings={settings}
                  canEdit={canEdit}
                  onUpdateAllocation={(allocationId, amount) =>
                    updateAllocation(allocationId, { amount })
                  }
                  onDeleteAllocation={(allocationId) => deleteAllocation(allocationId)}
                />
              ))}
            </div>
          )}
        </section>

        {!hasHydrated && (
          <p className="text-xs text-center text-zinc-400">Hydrating local cache…</p>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------
// Inline components
// ---------------------------------------------------------------------

function SharedSummary({
  banks,
  allocations,
  settings,
}: {
  banks: Bank[];
  allocations: Allocation[];
  settings: { currency: string };
}) {
  const { totalBalance, estimatedInterest } = (() => {
    let total = 0;
    let interest = 0;
    allocations.forEach((a) => {
      total += a.amount;
      const bank = banks.find((b) => b.id === a.bankId);
      if (bank) interest += (a.amount * bank.interestRate) / 100;
    });
    return { totalBalance: total, estimatedInterest: interest };
  })();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <Card className="bg-gradient-to-br from-primary/90 to-primary text-primary-foreground border-none shadow-lg overflow-hidden relative">
      <CardContent className="p-6">
        <p className="text-xs font-medium text-primary-foreground/80 uppercase tracking-wider mb-1">
          Total Net Worth
        </p>
        <div className="text-4xl font-bold tracking-tight">
          {formatCurrency(totalBalance)}
        </div>
        <p className="text-sm text-primary-foreground/80 mt-2 font-medium">
          +{formatCurrency(estimatedInterest)} est. interest / year
        </p>
      </CardContent>
    </Card>
  );
}

function SharedBankCard({
  bank,
  allocations,
  settings,
}: {
  bank: Bank;
  allocations: Allocation[];
  settings: { currency: string };
}) {
  const currentAmount = allocations
    .filter((a) => a.bankId === bank.id)
    .reduce((sum, a) => sum + a.amount, 0);
  const estimatedInterest = (currentAmount * bank.interestRate) / 100;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 2,
    }).format(amount);

  return (
    <Card
      className="overflow-hidden border-none shadow-sm"
      style={{ backgroundColor: bank.themeColor }}
    >
      <div className="bg-black/10 dark:bg-black/40 backdrop-blur-[2px] w-full h-full p-4">
        <CardContent className="p-0 flex flex-col gap-4 text-white">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-lg leading-tight tracking-tight drop-shadow-sm">
              {bank.name}
            </h3>
            <div className="bg-white/20 px-2 py-1 rounded-md text-xs font-bold backdrop-blur-md">
              {bank.interestRate}%
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-medium text-white/80 uppercase tracking-widest mb-1">
              Total Balance
            </p>
            <p className="text-2xl font-bold tracking-tight drop-shadow-md">
              {formatCurrency(currentAmount)}
            </p>
            <p className="text-xs text-white/70 mt-1 font-medium">
              + {formatCurrency(estimatedInterest)} / year
            </p>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function SharedPocketCard({
  pocket,
  allocations,
  banks,
  settings,
  canEdit,
  onUpdateAllocation,
  onDeleteAllocation,
}: {
  pocket: Pocket;
  allocations: Allocation[];
  banks: Bank[];
  settings: { currency: string };
  canEdit: boolean;
  onUpdateAllocation: (id: string, amount: number) => Promise<boolean>;
  onDeleteAllocation: (id: string) => Promise<boolean>;
}) {
  const pocketAllocs = allocations.filter((a) => a.pocketId === pocket.id);
  const total = pocketAllocs.reduce((sum, a) => sum + a.amount, 0);
  const progress =
    pocket.targetAmount && pocket.targetAmount > 0
      ? Math.min(100, Math.round((total / pocket.targetAmount) * 100))
      : 0;

  const [editing, setEditing] = useState<{ allocationId: string; amount: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <>
      <Card className="bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xl shadow-inner">
                {pocket.icon}
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 leading-none mb-1">
                  {pocket.name}
                </h3>
                <p className="text-xs text-zinc-500 font-medium">
                  {formatCurrency(total)}
                  {pocket.targetAmount ? ` / ${formatCurrency(pocket.targetAmount)}` : ''}
                </p>
              </div>
            </div>
          </div>

          {pocket.targetAmount !== undefined && pocket.targetAmount > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-zinc-100 dark:bg-zinc-800" />
            </div>
          )}

          {pocketAllocs.length > 0 && (
            <div className="mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
              {pocketAllocs.map((a) => {
                const bank = banks.find((b) => b.id === a.bankId);
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: bank?.themeColor ?? '#a1a1aa' }}
                      />
                      <span className="truncate text-zinc-700 dark:text-zinc-300">
                        {bank?.name ?? 'Unknown bank'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatCurrency(a.amount)}
                      </span>
                      {canEdit && (
                        <>
                          <button
                            type="button"
                            aria-label="Edit allocation"
                            onClick={() =>
                              setEditing({
                                allocationId: a.id,
                                amount: String(a.amount),
                              })
                            }
                            className="text-zinc-400 hover:text-primary p-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete allocation"
                            onClick={() => setDeletingId(a.id)}
                            className="text-zinc-400 hover:text-rose-500 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit allocation dialog */}
      <Dialog
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit allocation</DialogTitle>
            <DialogDescription>
              Change the amount allocated to this bank.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!editing) return;
              const next = parseFloat(editing.amount);
              if (Number.isNaN(next) || next < 0) return;
              await onUpdateAllocation(editing.allocationId, next);
              setEditing(null);
            }}
            className="space-y-3"
          >
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                type="number"
                min={0}
                step="any"
                value={editing?.amount ?? ''}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, amount: e.target.value } : prev,
                  )
                }
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        open={!!deletingId}
        onOpenChange={(o) => {
          if (!o) setDeletingId(null);
        }}
        title="Remove this allocation?"
        description="This will free up the money allocated here. You can re-allocate it anytime."
        onConfirm={async () => {
          if (!deletingId) return;
          await onDeleteAllocation(deletingId);
          setDeletingId(null);
        }}
      />
    </>
  );
}

function AddBankButton({ onAdd }: { onAdd: (bank: Bank) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add bank
      </Button>
      <BankDialog
        open={open}
        onOpenChange={setOpen}
        mode="add"
        onSubmit={async (data) => {
          const bank: Bank = {
            id: crypto.randomUUID(),
            name: data.name,
            interestRate: data.interestRate,
            logoUrl: data.logoUrl,
            themeColor: data.themeColor,
            createdAt: new Date().toISOString(),
          };
          const ok = await onAdd(bank);
          if (ok) {
            setOpen(false);
          }
        }}
      />
    </>
  );
}

function AddPocketButton({ onAdd }: { onAdd: (pocket: Pocket) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add pocket
      </Button>
      <PocketDialog
        open={open}
        onOpenChange={setOpen}
        mode="add"
        onSubmit={async (data) => {
          const pocket: Pocket = {
            id: crypto.randomUUID(),
            name: data.name,
            targetAmount: data.targetAmount,
            icon: data.icon,
            createdAt: new Date().toISOString(),
          };
          const ok = await onAdd(pocket);
          if (ok) {
            setOpen(false);
          }
        }}
      />
    </>
  );
}

function EmptyHint({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 text-center">
      <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{label}</p>
      <p className="text-xs text-zinc-500 mt-1">{hint}</p>
    </div>
  );
}

// Unused but re-exported to keep import surface tidy for downstream
// edits — also documents that this file is the friend-view entry.
export type { InvitePermission };