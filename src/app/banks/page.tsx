'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePocketRouterStore } from '@/hooks/usePocketRouterStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import { Bank } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ConfirmDeleteDialog } from '@/components/ConfirmDeleteDialog';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus,
  Landmark,
  Edit2,
  Trash2,
  TrendingUp,
  GripVertical,
} from 'lucide-react';
import { DraggableListItem } from '@/components/DraggableListItem';
import { sortByOrderAndDate } from '@/lib/utils';
import { BankDialog, BankFormData } from '@/components/BankDialog';

export default function ManageBanksPage() {
  const {
    banks,
    allocations,
    settings,
    addBank,
    updateBank,
    deleteBank,
    reorderBanks,
  } = usePocketRouterStore();

  const hasHydrated = useHasHydrated();

  // Add bank dialog
  const [isAddBankOpen, setIsAddBankOpen] = useState(false);

  // Edit bank dialog
  const [isEditBankOpen, setIsEditBankOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  // Delete confirmation
  const [deletingBank, setDeletingBank] = useState<Bank | null>(null);

  // --- Keyboard drag-drop a11y ---
  // Tracks the bank currently picked up via keyboard (if any), the index the
  // user has navigated to with arrow keys, and the latest live-region message.
  const [keyboardPickedUpBankId, setKeyboardPickedUpBankId] = useState<string | null>(null);
  const [keyboardTargetIndex, setKeyboardTargetIndex] = useState<number | null>(null);
  const [bankLiveMessage, setBankLiveMessage] = useState<string>('');

  const announceBank = useCallback((message: string) => {
    setBankLiveMessage(message);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: settings.currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBankTotal = (bankId: string) => {
    return allocations
      .filter((a) => a.bankId === bankId)
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const getBankPocketCount = (bankId: string) => {
    return new Set(
      allocations.filter((a) => a.bankId === bankId).map((a) => a.pocketId)
    ).size;
  };

  // Sort banks by user-defined order, fall back to creation time.
  const sortedBanks = useMemo(() => sortByOrderAndDate(banks), [banks]);

  const handleReorderBank = useCallback(
    async (fromId: string, toIndex: number) => {
      const ids = sortedBanks.map((b) => b.id);
      const fromIndex = ids.indexOf(fromId);
      if (fromIndex === -1) return;
      const clamped = Math.max(0, Math.min(toIndex, ids.length));
      if (clamped === fromIndex || clamped === fromIndex + 1) return;
      const next = [...ids];
      next.splice(fromIndex, 1);
      const adjusted = clamped > fromIndex ? clamped - 1 : clamped;
      next.splice(adjusted, 0, fromId);
      await reorderBanks(next);
    },
    [sortedBanks, reorderBanks]
  );

  // --- Keyboard a11y handlers ---
  const handleKeyboardPickupBank = useCallback(
    (bankId: string) => {
      setKeyboardPickedUpBankId(bankId);
      const idx = sortedBanks.findIndex((b) => b.id === bankId);
      setKeyboardTargetIndex(idx === -1 ? null : idx);
    },
    [sortedBanks]
  );

  const handleKeyboardDropBank = useCallback(
    async (bankId: string, toNewPosition: number) => {
      // `toNewPosition` is the desired NEW position in the list (0..lastIndex).
      // Convert to the insertIndex semantics expected by handleReorderBank.
      const ids = sortedBanks.map((b) => b.id);
      const fromIndex = ids.indexOf(bankId);
      if (fromIndex === -1) {
        setKeyboardPickedUpBankId(null);
        setKeyboardTargetIndex(null);
        return;
      }
      const clampedNew = Math.max(0, Math.min(toNewPosition, ids.length - 1));
      // If moving down by ≥1, insertIndex = newPos + 1; otherwise insertIndex = newPos.
      const insertIndex = clampedNew > fromIndex ? clampedNew + 1 : clampedNew;
      setKeyboardPickedUpBankId(null);
      setKeyboardTargetIndex(null);
      await handleReorderBank(bankId, insertIndex);
    },
    [sortedBanks, handleReorderBank]
  );

  const handleKeyboardCancelBank = useCallback(() => {
    setKeyboardPickedUpBankId(null);
    setKeyboardTargetIndex(null);
  }, []);

  const handleKeyboardTargetChangeBank = useCallback((targetIndex: number) => {
    setKeyboardTargetIndex(targetIndex);
  }, []);

  const resetBankForm = () => {
    setEditingBank(null);
  };

  const handleAddBank = (data: BankFormData) => {
    addBank({
      id: crypto.randomUUID(),
      name: data.name,
      interestRate: data.interestRate,
      logoUrl: data.logoUrl,
      themeColor: data.themeColor,
      createdAt: new Date().toISOString(),
    });

    resetBankForm();
    setIsAddBankOpen(false);
  };

  const openEditBankDialog = (bank: Bank) => {
    setEditingBank(bank);
    setIsEditBankOpen(true);
  };

  const handleEditBank = (data: BankFormData) => {
    if (!editingBank) return;

    updateBank(editingBank.id, {
      name: data.name,
      interestRate: data.interestRate,
      logoUrl: data.logoUrl,
      themeColor: data.themeColor,
    });

    resetBankForm();
    setIsEditBankOpen(false);
  };

  const handleDeleteBank = (bank: Bank) => {
    setDeletingBank(bank);
  };

  const confirmDeleteBank = () => {
    if (deletingBank) {
      deleteBank(deletingBank.id);
      setDeletingBank(null);
    }
  };

  if (!hasHydrated) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <main className="flex flex-col min-h-full bg-zinc-50 dark:bg-zinc-950 pb-28">
      {/* Live region for screen-reader announcements (keyboard drag-drop). */}
      <h2 className="sr-only">Bank reorder status</h2>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {bankLiveMessage}
      </div>

      {/* Header */}
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800 w-full">
        <div className="max-w-4xl mx-auto w-full px-6 pt-12 pb-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Banks
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
              {banks.length} bank{banks.length !== 1 ? 's' : ''} registered
            </p>
          </div>
          <Button
            onClick={() => {
              resetBankForm();
              setIsAddBankOpen(true);
            }}
            size="icon"
            className="rounded-full cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-6 pt-6 flex flex-col gap-4">
        {banks.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-3">
            <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Landmark className="w-7 h-7 text-zinc-400" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                No banks yet
              </p>
              <p className="text-xs text-zinc-500 max-w-[240px] mt-1">
                Add your bank accounts to start allocating money across pockets.
              </p>
            </div>
            <Button
              size="sm"
              className="mt-2 rounded-full cursor-pointer"
              onClick={() => {
                resetBankForm();
                setIsAddBankOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add First Bank
            </Button>
          </div>
        ) : (
          <div
            role="listbox"
            aria-label="Banks. Use arrow keys to reorder."
            aria-activedescendant={
              keyboardPickedUpBankId ? `sortable-${keyboardPickedUpBankId}` : undefined
            }
            className="flex flex-col gap-3"
          >
            {sortedBanks.map((bank, index) => {
              const total = getBankTotal(bank.id);
              const pocketCount = getBankPocketCount(bank.id);
              const estimatedInterest = (total * bank.interestRate) / 100;

              return (
                <DraggableListItem
                  key={bank.id}
                  id={bank.id}
                  index={index}
                  totalCount={sortedBanks.length}
                  itemName={bank.name}
                  isKeyboardPickedUp={keyboardPickedUpBankId === bank.id}
                  keyboardTargetIndex={
                    keyboardPickedUpBankId ? keyboardTargetIndex : null
                  }
                  onKeyboardPickup={handleKeyboardPickupBank}
                  onKeyboardDrop={handleKeyboardDropBank}
                  onKeyboardCancel={handleKeyboardCancelBank}
                  onKeyboardTargetChange={handleKeyboardTargetChangeBank}
                  onAnnounce={announceBank}
                  onReorder={handleReorderBank}
                  className="rounded-2xl"
                >
                  <Card
                    className="overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-200"
                    style={{ backgroundColor: bank.themeColor }}
                  >
                    <div className="bg-black/10 dark:bg-black/40 backdrop-blur-[2px] w-full h-full">
                      <CardContent className="p-0 text-white">
                        <div className="flex items-stretch">
                          {/* Bank info */}
                          <div className="flex-1 p-5">
                            <div className="flex items-start justify-between mb-3 gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                {/* Bank icon — logo if available, otherwise Landmark. */}
                                <div
                                  aria-hidden
                                  className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/20 backdrop-blur-sm shadow-sm flex-shrink-0"
                                >
                                  {bank.logoUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={bank.logoUrl}
                                      alt=""
                                      className="w-6 h-6 rounded-full object-cover bg-white"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Landmark className="w-5 h-5 text-white drop-shadow" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-bold text-lg leading-tight tracking-tight drop-shadow-sm truncate">
                                    {bank.name}
                                  </h3>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <TrendingUp className="w-3 h-3 text-white/70" />
                                    <span className="text-xs font-medium text-white/70">
                                      {bank.interestRate}% / year
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-end gap-6 flex-wrap">
                              <div>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
                                  Total Balance
                                </p>
                                <p className="text-xl font-bold tracking-tight drop-shadow-md">
                                  {formatCurrency(total)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
                                  Est. Interest
                                </p>
                                <p className="text-sm font-semibold text-white/80">
                                  +{formatCurrency(estimatedInterest)}
                                </p>
                              </div>
                              {pocketCount > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-0.5">
                                    Pockets
                                  </p>
                                  <p className="text-sm font-semibold text-white/80">
                                    {pocketCount}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action buttons + drag handle */}
                          <div className="flex flex-col border-l border-white/10">
                            <button
                              aria-label="Edit bank"
                              className="flex-1 flex items-center justify-center px-3 min-h-[44px] min-w-[44px] hover:bg-white/10 transition-colors duration-150 cursor-pointer"
                              onClick={() => openEditBankDialog(bank)}
                            >
                              <Edit2 className="w-4 h-4 text-white/80" />
                            </button>
                            <div className="border-t border-white/10" />
                            <button
                              aria-label="Delete bank"
                              className="flex-1 flex items-center justify-center px-3 min-h-[44px] min-w-[44px] hover:bg-rose-500/20 transition-colors duration-150 cursor-pointer"
                              onClick={() => handleDeleteBank(bank)}
                            >
                              <Trash2 className="w-4 h-4 text-white/80" />
                            </button>
                            <div className="border-t border-white/10" />
                            <span
                              aria-hidden
                              className="flex-1 flex items-center justify-center px-3 text-white/70 cursor-grab active:cursor-grabbing touch-none"
                            >
                              <GripVertical className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                </DraggableListItem>
              );
            })}
          </div>
        )}
        {sortedBanks.length > 1 && (
          <p className="text-[11px] text-center text-zinc-400 mt-1">
            Tip: long-press or drag a card to reorder
          </p>
        )}
      </div>

      <BankDialog
        open={isAddBankOpen}
        onOpenChange={setIsAddBankOpen}
        mode="add"
        onSubmit={handleAddBank}
      />

      <BankDialog
        open={isEditBankOpen}
        onOpenChange={setIsEditBankOpen}
        mode="edit"
        initialData={editingBank}
        onSubmit={handleEditBank}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={!!deletingBank}
        onOpenChange={(open) => !open && setDeletingBank(null)}
        title="Delete Bank"
        description={`Are you sure you want to delete "${deletingBank?.name}"? This will remove all its allocations across all pockets. This action cannot be undone.`}
        confirmLabel="Delete Bank"
        onConfirm={confirmDeleteBank}
      />
    </main>
  );
}
