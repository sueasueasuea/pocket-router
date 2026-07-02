'use client';

import { useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DraggableBankAllocationCard } from '@/components/DraggableBankAllocationCard';
import { TransferDialog } from '@/components/TransferDialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Landmark,
  Wallet,
  Sparkles,
} from 'lucide-react';



export default function PocketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: pocketId } = use(params);
  const router = useRouter();
  const {
    banks,
    pockets,
    allocations,
    settings,
    addAllocation,
    updateAllocation,
    deleteAllocation,
    transferBetweenBanks,
  } = usePocketRouterStore();

  const hasHydrated = useHasHydrated();
  const { isReady } = useRequireAuth();

  // Drag state
  const [draggingBankId, setDraggingBankId] = useState<string | null>(null);
  const [dragOverBankId, setDragOverBankId] = useState<string | null>(null);

  // Transfer dialog state
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFromBankId, setTransferFromBankId] = useState<string | null>(null);
  const [transferToBankId, setTransferToBankId] = useState<string | null>(null);

  // Add allocation dialog
  const [isAddAllocOpen, setIsAddAllocOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState('');
  const [allocAmount, setAllocAmount] = useState('');

  // Success animation
  const [showCelebration, setShowCelebration] = useState(false);

  // Remove allocation dialog
  const [removingAllocBankId, setRemovingAllocBankId] = useState<string | null>(null);

  // --- Keyboard drag-drop a11y ---
  // Tracks the bank currently picked up via keyboard, the bank the user has
  // navigated to with arrow keys, and the latest live-region message.
  const [keyboardPickedUpBankId, setKeyboardPickedUpBankId] = useState<string | null>(null);
  const [keyboardTargetBankId, setKeyboardTargetBankId] = useState<string | null>(null);
  const [allocLiveMessage, setAllocLiveMessage] = useState<string>('');

  const announceAlloc = useCallback((message: string) => {
    setAllocLiveMessage(message);
  }, []);

  const pocket = pockets.find((p) => p.id === pocketId);
  const pocketAllocations = allocations.filter((a) => a.pocketId === pocketId);
  const totalBalance = pocketAllocations.reduce((sum, a) => sum + a.amount, 0);
  const hasTarget = pocket?.targetAmount !== undefined && pocket.targetAmount > 0;
  const progress = hasTarget ? Math.min(100, Math.round((totalBalance / pocket!.targetAmount!) * 100)) : 0;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Drag handlers
  const handleDragStart = useCallback((bankId: string) => {
    setDraggingBankId(bankId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingBankId(null);
    setDragOverBankId(null);
  }, []);

  const handleDrop = useCallback(
    (targetBankId: string) => {
      if (draggingBankId && draggingBankId !== targetBankId) {
        setTransferFromBankId(draggingBankId);
        setTransferToBankId(targetBankId);
        setTransferOpen(true);
      }
      setDraggingBankId(null);
      setDragOverBankId(null);
    },
    [draggingBankId]
  );

  // Global drag over tracking for visual feedback
  const handleCardDragOver = useCallback(
    (bankId: string) => {
      if (draggingBankId && draggingBankId !== bankId) {
        setDragOverBankId(bankId);
      }
    },
    [draggingBankId]
  );

  // --- Keyboard a11y handlers ---
  const handleKeyboardPickupBank = useCallback((bankId: string) => {
    setKeyboardPickedUpBankId(bankId);
    setKeyboardTargetBankId(null);
  }, []);

  const handleKeyboardDropBank = useCallback(
    (targetBankId: string) => {
      if (
        keyboardPickedUpBankId &&
        keyboardPickedUpBankId !== targetBankId
      ) {
        setTransferFromBankId(keyboardPickedUpBankId);
        setTransferToBankId(targetBankId);
        setTransferOpen(true);
      }
      setKeyboardPickedUpBankId(null);
      setKeyboardTargetBankId(null);
    },
    [keyboardPickedUpBankId]
  );

  const handleKeyboardCancelBank = useCallback(() => {
    setKeyboardPickedUpBankId(null);
    setKeyboardTargetBankId(null);
  }, []);

  const handleKeyboardTargetChangeBank = useCallback((targetBankId: string) => {
    setKeyboardTargetBankId(targetBankId);
  }, []);

  // Transfer confirm
  const handleTransferConfirm = async (amount: number) => {
    if (!transferFromBankId || !transferToBankId) return;
    const success = await transferBetweenBanks(pocketId, transferFromBankId, transferToBankId, amount);
    setTransferOpen(false);
    setTransferFromBankId(null);
    setTransferToBankId(null);

    if (success) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }
  };

  // Add allocation
  const handleAddAllocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBankId || !allocAmount) return;
    const numAmount = parseFloat(allocAmount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // Check if allocation already exists
    const existing = allocations.find(
      (a) => a.pocketId === pocketId && a.bankId === selectedBankId
    );

    if (existing) {
      updateAllocation(existing.id, { amount: existing.amount + numAmount });
    } else {
      addAllocation({
        id: crypto.randomUUID(),
        pocketId,
        bankId: selectedBankId,
        amount: numAmount,
        createdAt: new Date().toISOString(),
      });
    }

    setSelectedBankId('');
    setAllocAmount('');
    setIsAddAllocOpen(false);
  };

  const handleDeleteBankFromPocket = (bankId: string) => {
    setRemovingAllocBankId(bankId);
  };

  const confirmRemoveAllocation = () => {
    if (removingAllocBankId) {
      const alloc = pocketAllocations.find((a) => a.bankId === removingAllocBankId);
      if (alloc) {
        deleteAllocation(alloc.id);
      }
      setRemovingAllocBankId(null);
    }
  };

  if (!hasHydrated || !isReady) {
    return (
      <main className="flex flex-col min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!pocket) {
    return (
      <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Wallet className="w-12 h-12 text-zinc-300 mx-auto" />
          <p className="font-semibold text-zinc-500">Pocket not found</p>
          <Button variant="outline" onClick={() => router.push('/pockets')} className="rounded-full cursor-pointer">
            Back to Pockets
          </Button>
        </div>
      </main>
    );
  }

  const fromBank = banks.find((b) => b.id === transferFromBankId) || null;
  const toBank = banks.find((b) => b.id === transferToBankId) || null;
  const maxTransferAmount = transferFromBankId
    ? pocketAllocations.find((a) => a.bankId === transferFromBankId)?.amount || 0
    : 0;

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-8 relative">
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="animate-ping">
            <Sparkles className="w-16 h-16 text-emerald-400" />
          </div>
        </div>
      )}

      {/* Live region for screen-reader announcements (keyboard drag-drop). */}
      <h2 className="sr-only">Bank allocation transfer status</h2>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {allocLiveMessage}
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-8 pb-4">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full -ml-2 cursor-pointer"
              onClick={() => router.push('/pockets')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

          </div>

          {/* Pocket info */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-3xl shadow-inner">
              {pocket.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {pocket.name}
              </h1>
              <p className="text-lg font-bold text-zinc-600 dark:text-zinc-300 mt-0.5">
                {formatCurrency(totalBalance)}
                {hasTarget && (
                  <span className="text-sm font-medium text-zinc-400 ml-1">
                    / {formatCurrency(pocket.targetAmount!)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Progress */}
          {hasTarget && (
            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <span>Target Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-zinc-100 dark:bg-zinc-800" />
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-4">
        {/* Section title */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
              Bank Allocations
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Drag to transfer between banks
            </p>
          </div>
          <Button
            size="sm"
            className="rounded-full h-8 text-xs cursor-pointer"
            onClick={() => {
              setSelectedBankId('');
              setAllocAmount('');
              setIsAddAllocOpen(true);
            }}
          >
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        </div>

        {/* Bank allocation cards */}
        {pocketAllocations.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Landmark className="w-7 h-7 text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                No allocations yet
              </p>
              <p className="text-xs text-zinc-500 max-w-[220px] mt-1">
                Add your first bank allocation to start tracking where this pocket&apos;s money lives.
              </p>
            </div>
            <Button
              size="sm"
              className="mt-2 rounded-full cursor-pointer"
              onClick={() => {
                setSelectedBankId('');
                setAllocAmount('');
                setIsAddAllocOpen(true);
              }}
            >
              Add First Allocation
            </Button>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="Bank allocations. Use arrow keys to choose a target bank for transfer."
            aria-activedescendant={
              keyboardPickedUpBankId ? `bank-alloc-${keyboardPickedUpBankId}` : undefined
            }
            className="flex flex-col gap-3"
          >
            {pocketAllocations.map((alloc) => {
              const bank = banks.find((b) => b.id === alloc.bankId);
              if (!bank) return null;

              return (
                <div
                  key={alloc.id}
                  className="relative group"
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleCardDragOver(bank.id);
                  }}
                  onDragLeave={() => setDragOverBankId(null)}
                >
                  <DraggableBankAllocationCard
                    bank={bank}
                    allocation={alloc}
                    settings={settings}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    isDragging={draggingBankId === bank.id}
                    isDragOver={dragOverBankId === bank.id}
                    onRemove={() => handleDeleteBankFromPocket(bank.id)}
                    isKeyboardPickedUp={keyboardPickedUpBankId === bank.id}
                    keyboardTargetBankId={
                      keyboardPickedUpBankId ? keyboardTargetBankId : null
                    }
                    totalCount={pocketAllocations.length}
                    onKeyboardPickup={handleKeyboardPickupBank}
                    onKeyboardDrop={handleKeyboardDropBank}
                    onKeyboardCancel={handleKeyboardCancelBank}
                    onKeyboardTargetChange={handleKeyboardTargetChangeBank}
                    onAnnounce={announceAlloc}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Summary footer */}
        {pocketAllocations.length > 1 && (
          <Card className="border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Total in {pocketAllocations.length} banks
              </span>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {formatCurrency(totalBalance)}
              </span>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Transfer Dialog */}
      <TransferDialog
        open={transferOpen}
        onOpenChange={(open) => {
          setTransferOpen(open);
          // Always reset keyboard pickup when the dialog closes (whether
          // confirmed or dismissed) so the user can pick up again.
          if (!open) {
            setKeyboardPickedUpBankId(null);
            setKeyboardTargetBankId(null);
          }
        }}
        fromBank={fromBank}
        toBank={toBank}
        maxAmount={maxTransferAmount}
        currency={settings.currency}
        onConfirm={handleTransferConfirm}
      />

      {/* Add Allocation Dialog */}
      <Dialog open={isAddAllocOpen} onOpenChange={setIsAddAllocOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Bank Allocation</DialogTitle>
            <DialogDescription>
              Route money from &ldquo;{pocket.name}&rdquo; to a bank account.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddAllocation} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alloc-bank">Select Bank</Label>
              {banks.length === 0 ? (
                <div className="text-sm text-zinc-500 py-3 text-center">
                  <p>No banks created yet.</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 rounded-full gap-1.5 text-xs cursor-pointer"
                    onClick={() => {
                      setIsAddAllocOpen(false);
                      router.push('/banks');
                    }}
                  >
                    <Landmark className="w-3.5 h-3.5" />
                    Go to Manage Banks
                  </Button>
                </div>
              ) : (
                <>
                  <Select value={selectedBankId} onValueChange={(val) => setSelectedBankId(val ?? '')}>
                    <SelectTrigger id="alloc-bank">
                      <SelectValue placeholder="Choose a Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.id} value={bank.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: bank.themeColor }}
                            />
                            {bank.name} ({bank.interestRate}%)
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mt-1 cursor-pointer"
                    onClick={() => {
                      setIsAddAllocOpen(false);
                      router.push('/banks');
                    }}
                  >
                    <Plus className="w-3 h-3" />
                    Create new bank
                  </button>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="alloc-amount">Amount</Label>
              <Input
                id="alloc-amount"
                type="number"
                step="1"
                min="1"
                placeholder="0"
                value={allocAmount}
                onChange={(e) => setAllocAmount(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className="w-full rounded-full cursor-pointer"
                disabled={!selectedBankId || !allocAmount || banks.length === 0}
              >
                Allocate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove Allocation Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!removingAllocBankId}
        onOpenChange={(open) => !open && setRemovingAllocBankId(null)}
        title="Remove Allocation"
        description={`Remove "${banks.find(b => b.id === removingAllocBankId)?.name}" allocation from this pocket? The money will no longer be tracked here.`}
        confirmLabel="Remove"
        onConfirm={confirmRemoveAllocation}
      />
    </main>
  );
}
